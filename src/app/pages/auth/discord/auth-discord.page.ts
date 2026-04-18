import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../auth/auth.service';
import { consumeAuthReturnUrl } from '../../../auth/auth-return-url';
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
  templateUrl: './auth-discord.page.html',
  styleUrl: './auth-discord.page.scss',
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

    this.auth.handleDiscordCallbackFromHash(window.location.hash);

    this.auth.meStrict().subscribe({
      next: (u) => {
        if (!u.accepted) {
          this.router.navigateByUrl('/waiting-acceptance');
          return;
        }
        this.router.navigateByUrl(consumeAuthReturnUrl());
      },
      error: (e) => {
        this.error =
          e instanceof HttpErrorResponse
            ? `${e.status} ${String(e?.error?.message ?? e.message)}`
            : 'auth_failed';
        this.toast.warn('Erro ao autenticar com discord');
      },
    });
  }

  retry() {
    this.auth.startDiscordLogin();
  }
}
