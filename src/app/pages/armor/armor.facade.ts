import { Injectable, computed, inject, signal } from '@angular/core';
import { ArmorApi, type ArmorPart, type ArmorSlot } from '../../api/armor.api';
import { ArmorEffectsPresenter } from './armor-effects.presenter';

@Injectable()
export class ArmorFacade {
  private api = inject(ArmorApi);
  private effects = inject(ArmorEffectsPresenter);

  loading = signal(false);
  error = signal('');

  slot = signal<ArmorSlot>('helmet');
  items = signal<ArmorPart[]>([]);
  q = signal('');

  filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    let list = this.items();

    if (query) {
      list = list.filter((it) => {
        const name = (it.name ?? '').toLowerCase();
        const code = (it.code ?? '').toLowerCase();
        const effText = this.effects.effectsSearchText(it).toLowerCase();
        const def = `${it.defense ?? 0} ${it.defenseSuccesRate ?? 0}`;

        return name.includes(query) || code.includes(query) || effText.includes(query) || def.includes(query);
      });
    }

    return list;
  });

  setSlot(slot: ArmorSlot) {
    this.slot.set(slot);
  }

  setQuery(v: string) {
    this.q.set(v);
  }

  load() {
    const slot = this.slot();

    this.loading.set(true);
    this.error.set('');

    this.api.list(slot).subscribe({
      next: (list) => {
        const normalized = (list ?? []).map((x) => ({
          ...x,
          effects: Array.isArray(x.effects) ? x.effects : [],
        }));
        this.items.set(normalized);
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar armor');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
