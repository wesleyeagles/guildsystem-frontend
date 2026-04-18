import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  loading = false;
  discordLoading = false;
  error = '';

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  submit() {
    this.error = '';
    if (this.form.invalid) return;

    this.loading = true;

    this.auth.login(this.form.getRawValue() as any).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
        this.router.navigateByUrl(returnUrl);
      },
      error: (e) => {
        if (e?.status === 403) {
          this.toast.warn('Conta pendente de aprovação. Aguarde a aceitação do administrador.');
          this.loading = false;
          return;
        }

        this.error = e?.error?.message ?? 'Falha no login';
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
