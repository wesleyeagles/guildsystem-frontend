import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  templateUrl: './waiting-acceptance.page.html',
  styleUrl: './waiting-acceptance.page.scss',
})
export class WaitingAcceptancePage implements OnInit, OnDestroy {
  readonly theme = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);

  private pollId?: ReturnType<typeof setInterval>;

  ngOnInit() {
    if (!this.auth.authed()) return;

    if (this.auth.safeUserSig()?.accepted) {
      this.router.navigateByUrl('/');
      return;
    }

    this.pollAcceptance();
    this.pollId = setInterval(() => this.pollAcceptance(), 15_000);
  }

  ngOnDestroy() {
    if (this.pollId) clearInterval(this.pollId);
  }

  private pollAcceptance() {
    this.auth.meStrict().subscribe({
      next: (u) => {
        if (u.accepted) {
          this.router.navigateByUrl('/');
        }
      },
      error: () => {},
    });
  }
}
