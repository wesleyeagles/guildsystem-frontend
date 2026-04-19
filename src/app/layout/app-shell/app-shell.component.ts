import { Component, DestroyRef, effect, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs/operators';
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
import { needsSiteProfileSetup } from '../../data/game-classes';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, DialogModule, SidebarComponent, MatSnackBarModule, TranslocoPipe],
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private eventsManager = inject(EventToastManager);
  collapsed = signal(false);
  mobileNavOpen = signal(false);

  private auth = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private eventsSocket = inject(EventsSocketService);
  private dialog = inject(Dialog);

  private inited = false;
  private nicknameSetupRef: DialogRef<
    FirstNicknameSetupResult | null,
    FirstNicknameSetupDialogComponent
  > | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.mobileNavOpen.set(false));

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
      if (!needsSiteProfileSetup(u)) {
        this.nicknameSetupRef = null;
        return;
      }

      if (this.nicknameSetupRef) return;

      queueMicrotask(() => {
        const latest = this.auth.safeUserSig();
        if (!latest || !needsSiteProfileSetup(latest)) return;
        if (this.nicknameSetupRef) return;

        const ref = this.dialog.open<
          FirstNicknameSetupResult | null,
          FirstNicknameSetupData,
          FirstNicknameSetupDialogComponent
        >(FirstNicknameSetupDialogComponent, {
          disableClose: true,
          data: {
            currentNickname: latest.nickname ?? '',
            currentCharacterClass: latest.characterClass ?? '',
          },
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

  toggleMobileNav() {
    this.mobileNavOpen.update((v) => !v);
  }

  closeMobileNav() {
    this.mobileNavOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMobileNav();
  }
}
