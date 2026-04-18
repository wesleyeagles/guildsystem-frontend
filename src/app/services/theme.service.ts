import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'guildsystem.theme';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readStoredTheme());

  constructor() {
    this.apply(this.mode());
  }

  setMode(next: ThemeMode) {
    this.mode.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    this.apply(next);
  }

  toggle() {
    this.setMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: ThemeMode) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }
}

function readStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') {
    return 'dark';
  }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'light' || s === 'dark') {
      return s;
    }
  } catch {
    /* ignore */
  }
  return 'dark';
}
