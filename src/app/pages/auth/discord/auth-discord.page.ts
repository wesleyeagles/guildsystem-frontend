import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../auth/auth.service';
import { ToastService } from '../../../ui/toast/toast.service';

function decodeErr(v: string) {
  try {
    return decodeURIComponent(String(v ?? ''));
  } catch {
    return String(v ?? '');
  }
}

function readHashParams() {
  const h = String(window.location.hash ?? '').replace(/^#/, '');
  const sp = new URLSearchParams(h);
  return {
    accessToken: sp.get('accessToken'),
    error: sp.get('error'),
    retryAfter: sp.get('retryAfter'),
  };
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div class="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <div class="text-xl font-bold mb-2">Conectando com Discord</div>

        @if (!error) {
          <div class="text-slate-300 text-sm">Aguarde um instante...</div>
        } @else {
          <div class="text-red-300 text-sm break-words">{{ error }}</div>

          <div class="mt-4 flex gap-2">
            <button
              type="button"
              class="px-3 py-2 rounded-md transition font-bold text-[#0F172A] bg-[#00FEFF] hover:bg-[#000] hover:text-[#00FEFF]"
              (click)="retry()"
              [disabled]="rateLimited"
            >
              Tentar de novo
            </button>

            <a
              class="px-3 py-2 rounded-md transition font-bold border border-slate-800 bg-slate-950 hover:bg-slate-900"
              routerLink="/login"
            >
              Voltar pro login
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuthDiscordPage {
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  error = '';
  rateLimited = false;

  constructor() {
    const { accessToken, error, retryAfter } = readHashParams();

    if (error) {
      if (error === 'rate_limited') {
        const sec = Number(retryAfter ?? 60);
        this.rateLimited = true;
        this.error = `Rate limit do Discord. Aguarde ${Number.isFinite(sec) ? sec : 60}s e tente novamente.`;
        this.toast.warn('Discord rate limited');
        return;
      }

      this.error = decodeErr(error);
      this.toast.warn('Erro ao autenticar com discord');
      return;
    }

    if (!accessToken) {
      this.error = 'missing_accessToken';
      this.toast.warn('Erro ao autenticar com discord');
      return;
    }

    const r = this.auth.handleDiscordCallbackFromHash(window.location.hash);

    if (r.ok) {
      this.auth.meStrict().subscribe();
    }

    this.auth.meStrict().subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (e) => {
        if (e instanceof HttpErrorResponse && e.status === 403) {
          this.router.navigateByUrl('/waiting-acceptance');
          return;
        }

        this.error = e instanceof HttpErrorResponse ? `${e.status} ${String(e?.error?.message ?? e.message)}` : 'auth_failed';
        this.toast.warn('Erro ao autenticar com discord');
      },
    });
  }

  retry() {
    this.auth.startDiscordLogin();
  }
}
