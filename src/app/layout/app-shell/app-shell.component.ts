import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../auth/auth.service';
import { EventsSocketService } from '../../events/events-socket.service';
import { EventToastManager } from '../../events/event-toast.manager';

@Component({
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, MatSnackBarModule],
  selector: 'app-shell',
  template: `
    <div class="h-screen bg-slate-950 text-slate-100">
      <app-header class="fixed top-0 left-0 right-0 z-30" />

      <app-sidebar
        class="fixed top-0 left-0 h-screen z-20"
        [collapsed]="collapsed()"
        (toggle)="collapsed.set(!collapsed())"
      />

      <div
        class="pt-16 h-screen overflow-hidden transition-all"
        [class.pl-72]="!collapsed()"
        [class.pl-20]="collapsed()"
      >
        <main class="h-full p-6 overflow-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  private eventsManager = inject(EventToastManager);
  collapsed = signal(false);

  private auth = inject(AuthService);
  private eventsSocket = inject(EventsSocketService);

  private inited = false;


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
  }
}
