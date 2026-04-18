export const I18N_LANG_STORAGE_KEY = 'guildsystem.lang';

export const I18N_AVAILABLE_LANGS = ['pt-BR', 'en', 'ru'] as const;

export type I18nLang = (typeof I18N_AVAILABLE_LANGS)[number];
