import { Injectable, computed, inject, signal } from '@angular/core';
import { CastsApi, Cast } from '../../api/casts.api';
import { CastEffectsPresenter } from './cast-effects.presenter';
import type { CastTypeFilter } from './casts.types';

@Injectable()
export class CastsFacade {
  private api = inject(CastsApi);
  private effects = inject(CastEffectsPresenter);

  loading = signal(false);
  error = signal('');

  items = signal<Cast[]>([]);
  q = signal('');

  selectedType = signal<CastTypeFilter>('All');

  filtered = computed(() => {
    const sel = this.selectedType();
    const query = this.q().trim().toLowerCase();

    let list = this.items();
    if (sel !== 'All') list = list.filter((x) => x.type === sel);

    if (query) {
      list = list.filter((x) => {
        const name = (x.name ?? '').toLowerCase();
        const code = (x.code ?? '').toLowerCase();
        const desc = String((x as any).description ?? '').toLowerCase();

        const effText = this.effects
          .displayEffects(x)
          .map((e) => `${this.effects.effectLabel(e)} ${this.effects.levelsSearchText(x, e)}`.toLowerCase())
          .join(' ');

        return name.includes(query) || code.includes(query) || desc.includes(query) || effText.includes(query);
      });
    }

    return list;
  });

  setType(v: CastTypeFilter) {
    this.selectedType.set(v);
  }

  setQuery(v: string) {
    this.q.set(v);
  }

  countByType(t: CastTypeFilter) {
    const all = this.items();
    if (t === 'All') return all.length;
    return all.filter((x) => x.type === t).length;
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (list) => {
        const normalized = (list ?? []).map((x) => ({
          ...x,
          effects: Array.isArray((x as any).effects) ? (x as any).effects : [],
        }));
        this.items.set(normalized as any);
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar casts');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
