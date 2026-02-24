import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogModule } from '@angular/cdk/dialog';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../auth/auth.service';
import { EventsSocketService } from '../../events/events-socket.service';
import { EventToastManager } from '../../events/event-toast.manager';

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
