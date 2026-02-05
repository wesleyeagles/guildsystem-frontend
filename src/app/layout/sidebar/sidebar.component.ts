import { Component, inject, effect, computed } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';

import { AuthService, SafeUser } from '../../auth/auth.service';
import { discordAvatarUrl } from '../../utils/discord-avatar';
import { LinkComponent } from './components/link/link.component';
import { CreateEventComponent } from '../../ui/modal/create-event/create-event.component';

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

  user: SafeUser | null = null;
  userAvatar: string | null = null;

  isAdminArea = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'admin' || s === 'root';
  });

  isModeratorArea = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'moderator' || s === 'admin' || s === 'root';
  });

  constructor() {
    effect(() => {
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
    });
  }

  openCreateEventModal() {
    this.dialog.open(CreateEventComponent, {
      // data: null, // opcional
      // panelClass: 'dialog-panel', // se você usa classes globais
    });
  }
}
