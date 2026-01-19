import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAppInitializer, inject } from '@angular/core';
import { catchError, of, take } from 'rxjs';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/auth/auth.interceptor';
import { refreshInterceptor } from './app/auth/refresh.interceptor';
import { AuthService } from './app/auth/auth.service';
import { provideAnimations } from '@angular/platform-browser/animations';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      // ✅ retorna Observable (sem subscribe) e garante que completa
      return auth.refresh().pipe(
        take(1),
        catchError(() => of(null)),
      );
    }),
  ],
});
