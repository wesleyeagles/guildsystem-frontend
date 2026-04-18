import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Dialog, DialogModule, DialogRef } from '@angular/cdk/dialog';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../auth/auth.service';
import { EventsSocketService } from '../../events/events-socket.service';
import { EventToastManager } from '../../events/event-toast.manager';
import {
  FirstNicknameSetupDialogComponent,
  type FirstNicknameSetupData,
  type FirstNicknameSetupResult,
} from '../../ui/modal/first-nickname-setup/first-nickname-setup.dialog';

@Component({
  standalone: true,
  imports: [RouterOutlet, DialogModule, SidebarComponent, MatSnackBarModule],
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  private eventsManager = inject(EventToastManager);
  collapsed = signal(false);

  private auth = inject(AuthService);
  private eventsSocket = inject(EventsSocketService);
  private dialog = inject(Dialog);

  private inited = false;
  private nicknameSetupRef: DialogRef<
    FirstNicknameSetupResult | null,
    FirstNicknameSetupDialogComponent
  > | null = null;

  constructor() {
    effect(() => {
      const token = this.auth.accessToken();

      if (token) {
        this.eventsSocket.connect();

        if (!this.inited) {
          this.inited = true;
          this.eventsManager.init();
        }
      } else {
        this.eventsSocket.disconnect();
        this.inited = false;
      }
    });

    effect(() => {
      const u = this.auth.safeUserSig();
      if (!u?.accepted || u.hasConfirmedSiteNickname !== false) {
        this.nicknameSetupRef = null;
        return;
      }

      if (this.nicknameSetupRef) return;

      queueMicrotask(() => {
        const latest = this.auth.safeUserSig();
        if (!latest?.accepted || latest.hasConfirmedSiteNickname !== false) return;
        if (this.nicknameSetupRef) return;

        const ref = this.dialog.open<
          FirstNicknameSetupResult | null,
          FirstNicknameSetupData,
          FirstNicknameSetupDialogComponent
        >(FirstNicknameSetupDialogComponent, {
          disableClose: true,
          data: { currentNickname: latest.nickname ?? '' },
        });
        this.nicknameSetupRef = ref;
        ref.closed.subscribe((result) => {
          this.nicknameSetupRef = null;
          const r = result as FirstNicknameSetupResult | null | undefined;
          if (r && r.user) {
            this.auth.setSafeUser(r.user);
          }
        });
      });
    });
  }
}
