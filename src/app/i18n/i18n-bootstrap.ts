import { getBrowserLang } from '@jsverse/transloco';
import { I18N_AVAILABLE_LANGS, I18N_LANG_STORAGE_KEY } from './i18n.constants';

export function setDocumentLang(lang: string) {
  document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : lang;
}

export function resolveInitialLang(): string {
  const available = new Set<string>(I18N_AVAILABLE_LANGS);
  let lang = localStorage.getItem(I18N_LANG_STORAGE_KEY);
  if (!lang || !available.has(lang)) {
    const b = getBrowserLang() ?? 'en';
    if (b.startsWith('pt')) {
      lang = 'pt-BR';
    } else if (b.startsWith('ru')) {
      lang = 'ru';
    } else {
      lang = 'en';
    }
  }
  return lang;
}
