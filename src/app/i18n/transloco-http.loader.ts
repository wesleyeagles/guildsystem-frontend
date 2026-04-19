import { APP_BASE_HREF } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';

function i18nJsonUrl(baseHref: string, lang: string): string {
  const base = String(baseHref ?? '/').replace(/\/+$/, '');
  const path = `i18n/${lang}.json`;
  return base ? `${base}/${path}` : `/${path}`;
}

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  private readonly baseHref = inject(APP_BASE_HREF);

  getTranslation(lang: string): Observable<Translation> {
    const v = environment.i18nAssetVersion ?? '0';
    const storageKey = `guildsystem.i18n.${lang}.${v}`;

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        return of(JSON.parse(raw) as Translation);
      }
    } catch {
      /* ignore */
    }

    const url = i18nJsonUrl(this.baseHref, lang);
    return this.http.get<Translation>(url, { params: { v } }).pipe(
      tap((t) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(t));
        } catch {
          /* quota */
        }
      }),
    );
  }
}
