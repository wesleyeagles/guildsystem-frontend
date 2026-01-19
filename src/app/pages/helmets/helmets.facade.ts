import { Injectable, computed, inject, signal } from '@angular/core';
import { HelmetsApi, type Helmet } from '../../api/helmets.api';
import { HelmetEffectsPresenter } from './helmet-effects.presenter';

@Injectable()
export class HelmetsFacade {
  private api = inject(HelmetsApi);
  private effects = inject(HelmetEffectsPresenter);

  loading = signal(false);
  error = signal('');

  items = signal<Helmet[]>([]);
  q = signal('');

  filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    let list = this.items();

    if (query) {
      list = list.filter((h) => {
        const name = (h.name ?? '').toLowerCase();
        const code = (h.code ?? '').toLowerCase();
        const effText = this.effects.effectsSearchText(h).toLowerCase();

        const def = `${h.defense ?? 0} ${h.defenseSuccesRate ?? 0}`;

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
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar helmets');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
