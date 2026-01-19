import { Injectable, computed, inject, signal } from '@angular/core';
import { ShieldsApi, type ShieldApi } from '../../api/shields.api';
import { ShieldsEffectsPresenter } from './shield-effects.presenter';

@Injectable()
export class ShieldsFacade {
  private api = inject(ShieldsApi);
  private effects = inject(ShieldsEffectsPresenter);

  loading = signal(false);
  error = signal('');

  items = signal<ShieldApi[]>([]);
  q = signal('');

  filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    let list = this.items();

    if (query) {
      list = list.filter((it) => {
        const name = (it.name ?? '').toLowerCase();
        const code = (it.code ?? '').toLowerCase();
        const effText = this.effects.effectsSearchText(it).toLowerCase();
        const def = `${it.defense ?? 0}`;

        return name.includes(query) || code.includes(query) || effText.includes(query) || def.includes(query);
      });
    }

    return list;
  });

  setQuery(v: string) {
    this.q.set(v);
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (list) => {
        const normalized = (list ?? []).map((x) => ({
          ...x,
          effects: Array.isArray(x.effects) ? x.effects : [],
        }));
        this.items.set(normalized);
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar shields');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
