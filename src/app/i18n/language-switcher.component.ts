import { Component, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { I18N_AVAILABLE_LANGS, I18N_LANG_STORAGE_KEY } from './i18n.constants';
import { setDocumentLang } from './i18n-bootstrap';

@Component({
  standalone: true,
  selector: 'app-language-switcher',
  imports: [TranslocoPipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  private readonly transloco = inject(TranslocoService);

  readonly showLabel = input(true);
  readonly compact = input(false);

  readonly activeLangSig = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Sem barra inicial: resolve contra `<base href>` (ex.: GitHub Pages em subpasta). */
  readonly langOptions = [
    { id: 'pt-BR' as const, flagSrc: 'flags/pt-br.svg', labelKey: 'language.pt' as const },
    { id: 'en' as const, flagSrc: 'flags/en.svg', labelKey: 'language.en' as const },
    { id: 'ru' as const, flagSrc: 'flags/ru.svg', labelKey: 'language.ru' as const },
  ];

  setLang(lang: string) {
    if (!I18N_AVAILABLE_LANGS.includes(lang as (typeof I18N_AVAILABLE_LANGS)[number])) {
      return;
    }
    this.transloco.setActiveLang(lang);
    localStorage.setItem(I18N_LANG_STORAGE_KEY, lang);
    setDocumentLang(lang);
  }
}
