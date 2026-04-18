import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './auth-discord.page.html',
  styleUrl: './auth-discord.page.scss',
})
export class AuthDiscordPage {
  private router = inject(Router);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);

  error = '';
  rateLimited = false;

  constructor() {
    const { accessToken, error, retryAfter } = readHashParams();

    if (error) {
      if (error === 'rate_limited') {
        const sec = Number(retryAfter ?? 60);
        this.rateLimited = true;
        const s = Number.isFinite(sec) ? sec : 60;
        this.error = this.transloco.translate('authDiscord.rateLimitError', { sec: s });
        this.toast.warn(this.transloco.translate('authDiscord.rateLimited'));
        return;
      }

      this.error = decodeErr(error);
      this.toast.warn(this.transloco.translate('authDiscord.authError'));
      return;
    }

    if (!accessToken) {
      this.error = 'missing_accessToken';
      this.toast.warn(this.transloco.translate('authDiscord.authError'));
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
        this.toast.warn(this.transloco.translate('authDiscord.authError'));
      },
    });
  }

  retry() {
    this.auth.startDiscordLogin();
  }
}
