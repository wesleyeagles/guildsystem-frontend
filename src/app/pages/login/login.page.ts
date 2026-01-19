import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div class="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <h1 class="text-2xl font-bold mb-1">Entrar</h1>
        <p class="text-slate-300 mb-6">Acesse sua conta</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="text-sm text-slate-300">Email</label>
            <input
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
              formControlName="email"
              autocomplete="email"
            />
          </div>

          <div>
            <label class="text-sm text-slate-300">Senha</label>
            <input
              type="password"
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
              formControlName="password"
              autocomplete="current-password"
            />
          </div>

          <button
            class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
            [disabled]="form.invalid || loading"
          >
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <div class="mt-4 text-sm text-slate-300">
          Não tem conta?
          <a class="text-indigo-400 hover:underline" routerLink="/register">Cadastrar</a>
        </div>

        @if (error) {
          <div class="mt-4 text-sm text-red-300">{{ error }}</div>
        }
      </div>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  loading = false;
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
        // ✅ backend: 403 quando accepted=false
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
}
