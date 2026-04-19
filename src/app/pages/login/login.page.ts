import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../auth/auth.service';
import { AUTH_RETURN_KEY, consumeAuthReturnUrl } from '../../auth/auth-return-url';
import { LanguageSwitcherComponent } from '../../i18n/language-switcher.component';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, LanguageSwitcherComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage implements OnInit {
  readonly theme = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);

  loading = false;
  discordLoading = false;
  error = '';

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  ngOnInit() {
    const legacy = this.route.snapshot.queryParamMap.get('returnUrl');
    if (legacy === null) return;

    sessionStorage.setItem(AUTH_RETURN_KEY, legacy || '/');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  submit() {
    this.error = '';
    if (this.form.invalid) return;

    this.loading = true;

    this.auth.login(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.router.navigateByUrl(consumeAuthReturnUrl());
      },
      error: (e) => {
        if (e?.status === 403) {
          this.toast.warn(this.transloco.translate('login.pendingApproval'));
          this.loading = false;
          return;
        }

        this.error = e?.error?.message ?? this.transloco.translate('login.errorFallback');
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }

  loginWithDiscord() {
    this.error = '';
    this.discordLoading = true;
    try {
      this.auth.startDiscordLogin();
    } finally {
      this.discordLoading = false;
    }
  }
}
