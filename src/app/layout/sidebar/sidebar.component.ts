import { Component, inject, effect, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { AuthService, SafeUser } from '../../auth/auth.service';
import { discordAvatarUrl } from '../../utils/discord-avatar';
import { LinkComponent } from './components/link/link.component';
import { CreateEventComponent } from '../../ui/modal/create-event/create-event.component';
import { CreateDonationComponent } from '../../ui/modal/create-donation/create-donation.component';
import { EventToastManager } from '../../events/event-toast.manager';
import { DonationsApi, type DonationMyStatus } from '../../api/donations.api';
import { ThemeService } from '../../services/theme.service';
import { I18N_LANG_STORAGE_KEY } from '../../i18n/i18n.constants';
import { setDocumentLang } from '../../i18n/i18n-bootstrap';

@Component({
  standalone: true,
  imports: [LucideAngularModule, RouterLink, LinkComponent, TranslocoPipe],
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly toastManager = inject(EventToastManager);
  private readonly donationsApi = inject(DonationsApi);
  private readonly transloco = inject(TranslocoService);

  readonly activeLangSig = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  user: SafeUser | null = null;
  userAvatar: string | null = null;

  donationStatus = signal<DonationMyStatus | null>(null);

  isAdminArea = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'admin' || s === 'root';
  });

  isModeratorArea = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'moderator' || s === 'admin' || s === 'root';
  });

  donationButtonDisabled = computed(() => {
    const st = this.donationStatus();
    if (!st) return false;
    return st.status !== 'can_donate';
  });

  donationButtonLabel = computed(() => {
    this.activeLangSig();
    const st = this.donationStatus();
    if (!st) return this.transloco.translate('donation.donate');
    if (st.status === 'pending') return this.transloco.translate('donation.pending');
    if (st.status === 'cooldown' && st.nextDonationAt) {
      const end = new Date(st.nextDonationAt).getTime();
      const now = Date.now();
      const ms = Math.max(0, end - now);
      if (ms <= 0) return this.transloco.translate('donation.donate');
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      if (h > 0) {
        return this.transloco.translate('donation.cooldownHoursMinutes', {
          hours: h,
          minutes: m,
        });
      }
      return this.transloco.translate('donation.cooldownMinutes', { minutes: m });
    }
    return this.transloco.translate('donation.donate');
  });

  constructor() {
    effect((onCleanup) => {
      const u = this.auth.safeUserSig();

      this.userAvatar = discordAvatarUrl(
        {
          discordId: u?.discordId ?? null,
          discordAvatar: u?.discordAvatar ?? null,
          discordDiscriminator: u?.discordDiscriminator ?? null,
        },
        40,
      );

      this.user = u;

      const token = this.auth.accessToken();
      if (token) {
        this.toastManager.init();
        this.refreshDonationStatus();
        const sub = interval(60_000)
          .pipe(switchMap(() => this.donationsApi.myStatus()))
          .subscribe({
            next: (st) => this.donationStatus.set(st),
            error: () => this.donationStatus.set(null),
          });
        onCleanup(() => sub.unsubscribe());
      } else {
        this.donationStatus.set(null);
      }
    });
  }

  refreshDonationStatus() {
    this.donationsApi.myStatus().subscribe({
      next: (st) => this.donationStatus.set(st),
      error: () => this.donationStatus.set(null),
    });
  }

  openCreateEventModal() {
    this.dialog.open(CreateEventComponent, {});
  }

  openDonationModal() {
    const ref = this.dialog.open(CreateDonationComponent, {});
    ref.closed.subscribe((result) => {
      if (result === 'ok') this.refreshDonationStatus();
    });
  }

  setLang(event: Event) {
    const el = event.target as HTMLSelectElement;
    const lang = el.value;
    this.transloco.setActiveLang(lang);
    localStorage.setItem(I18N_LANG_STORAGE_KEY, lang);
    setDocumentLang(lang);
  }
}
