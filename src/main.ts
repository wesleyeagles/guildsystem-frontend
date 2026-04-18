import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/auth/auth.interceptor';
import { refreshInterceptor } from './app/auth/refresh.interceptor';
import { provideQuillConfig } from 'ngx-quill/config';

import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

(function initThemeBeforeBootstrap() {
  try {
    const key = 'guildsystem.theme';
    const s = localStorage.getItem(key);
    const t = s === 'light' || s === 'dark' ? s : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t === 'dark' ? 'dark' : 'light';
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideToastr({
      positionClass: 'toast-bottom-right',
      timeOut: 2500,
      closeButton: true,
      progressBar: true,
      preventDuplicates: true,
    }),
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
    provideQuillConfig({}),
  ],
});
