import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

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

    return this.http.get<Translation>(`/i18n/${lang}.json`, { params: { v } }).pipe(
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
