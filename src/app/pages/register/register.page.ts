import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../auth/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
})
export class RegisterPage {
  readonly theme = inject(ThemeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);

  loading = false;
  error = '';

  form = new FormGroup({
    nickname: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  submit() {
    this.error = '';
    if (this.form.invalid) return;

    this.loading = true;
    const payload = this.form.getRawValue() as { nickname: string; email: string; password: string };

    this.auth.register(payload).subscribe({
      next: () => {
        this.toast.info(this.transloco.translate('register.toastSent'));
        this.router.navigateByUrl('/waiting-acceptance');
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.error = Array.isArray(msg) ? msg.join(', ') : msg ?? this.transloco.translate('register.errorFallback');
        this.toast.error(this.error);
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }
}
