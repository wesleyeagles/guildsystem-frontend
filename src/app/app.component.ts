import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { ThemeService } from './services/theme.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  auth = inject(AuthService);
  private readonly theme = inject(ThemeService);

  constructor() {
    this.theme.mode();
    this.auth.bootstrap().pipe(take(1)).subscribe();
  }
}
