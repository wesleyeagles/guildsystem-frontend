import { bootstrapApplication } from '@angular/platform-browser';
import { inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/auth/auth.interceptor';
import { refreshInterceptor } from './app/auth/refresh.interceptor';
import { provideQuillConfig } from 'ngx-quill/config';
import { TranslocoHttpLoader } from './app/i18n/transloco-http.loader';
import { resolveInitialLang, setDocumentLang } from './app/i18n/i18n-bootstrap';
import { I18N_AVAILABLE_LANGS, I18N_LANG_STORAGE_KEY } from './app/i18n/i18n.constants';
import { environment } from './environments/environment';

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
    provideTransloco({
      config: {
        availableLangs: [...I18N_AVAILABLE_LANGS],
        defaultLang: 'pt-BR',
        fallbackLang: ['en', 'pt-BR'],
        reRenderOnLangChange: true,
        prodMode: environment.production,
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const lang = resolveInitialLang();
      transloco.setActiveLang(lang);
      setDocumentLang(lang);
      localStorage.setItem(I18N_LANG_STORAGE_KEY, lang);
    }),
    provideQuillConfig({}),
  ],
});
