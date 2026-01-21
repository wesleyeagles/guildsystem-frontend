import { Injectable, computed, inject, signal } from '@angular/core';
import { Weapon, WeaponsApi } from '../../../api/weapons.api';
import { WeaponEffectsPresenter } from './weapon-effects.presenter';

@Injectable()
export class WeaponsFacade {
  private api = inject(WeaponsApi);
  private effects = inject(WeaponEffectsPresenter);

  loading = signal(false);
  error = signal('');

  items = signal<Weapon[]>([]);
  q = signal('');

  filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    let list = this.items();

    if (query) {
      list = list.filter((w) => {
        const name = (w.name ?? '').toLowerCase();
        const code = (w.code ?? '').toLowerCase();
        const cast = (w.cast?.name ?? '').toLowerCase();

        const effText = this.effects.effectsSearchText(w).toLowerCase();
        const atk = `${w.attack?.min ?? 0} ${w.attack?.max ?? 0} ${w.forceAttack?.min ?? 0} ${w.forceAttack?.max ?? 0}`;

        return (
          name.includes(query) ||
          code.includes(query) ||
          cast.includes(query) ||
          effText.includes(query) ||
          atk.includes(query)
        );
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
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar weapons');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
