import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

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
        this.toast.info('Cadastro enviado. Aguarde a aprovação do administrador.');
        this.router.navigateByUrl('/waiting-acceptance');
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.error = Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao cadastrar';
        this.toast.error(this.error);
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }
}
