import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../ui/toast/toast.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div class="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <h1 class="text-2xl font-bold mb-1">Criar conta</h1>
        <p class="text-slate-300 mb-6">Cadastre-se para acessar o sistema</p>

        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="text-sm text-slate-300">Nickname</label>
            <input
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
              formControlName="nickname"
              autocomplete="nickname"
            />
            @if (form.controls.nickname.touched && form.controls.nickname.invalid) {
              <div class="mt-1 text-xs text-red-300">Informe seu nickname.</div>
            }
          </div>

          <div>
            <label class="text-sm text-slate-300">Email</label>
            <input
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
              formControlName="email"
              autocomplete="email"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <div class="mt-1 text-xs text-red-300">Informe um email válido.</div>
            }
          </div>

          <div>
            <label class="text-sm text-slate-300">Senha</label>
            <input
              type="password"
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
              formControlName="password"
              autocomplete="new-password"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <div class="mt-1 text-xs text-red-300">
                A senha deve ter no mínimo 8 caracteres.
              </div>
            }
          </div>

          <button
            class="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
            [disabled]="form.invalid || loading"
          >
            @if (loading) { Cadastrando... } @else { Cadastrar }
          </button>
        </form>

        <div class="mt-4 text-sm text-slate-300">
          Já tem conta?
          <a class="text-indigo-400 hover:underline" routerLink="/login">Entrar</a>
        </div>

        @if (error) {
          <div class="mt-4 text-sm text-red-300">{{ error }}</div>
        }
      </div>
    </div>
  `,
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
