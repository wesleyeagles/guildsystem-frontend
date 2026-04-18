import { Component, inject, effect, computed, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { AuthService, SafeUser } from '../../auth/auth.service';
import { discordAvatarUrl } from '../../utils/discord-avatar';
import { LinkComponent } from './components/link/link.component';
import { CreateEventComponent } from '../../ui/modal/create-event/create-event.component';
import { CreateDonationComponent } from '../../ui/modal/create-donation/create-donation.component';
import { EventToastManager } from '../../events/event-toast.manager';
import { DonationsApi, type DonationMyStatus } from '../../api/donations.api';

@Component({
  standalone: true,
  imports: [LucideAngularModule, RouterLink, LinkComponent],
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(Dialog);
  private readonly toastManager = inject(EventToastManager);
  private readonly donationsApi = inject(DonationsApi);

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
    const st = this.donationStatus();
    if (!st) return 'Doar';
    if (st.status === 'pending') return 'Pendente';
    if (st.status === 'cooldown' && st.nextDonationAt) {
      const end = new Date(st.nextDonationAt).getTime();
      const now = Date.now();
      const ms = Math.max(0, end - now);
      if (ms <= 0) return 'Doar';
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      if (h > 0) return `Pode doar em ${h}h ${m}m`;
      return `Pode doar em ${m}m`;
    }
    return 'Doar';
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
}
