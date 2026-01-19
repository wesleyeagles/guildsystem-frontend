import { Injectable, computed, inject, signal } from '@angular/core';
import { AccessoriesApi, type AccessoryItem, type AccessorySlot } from '../../api/accessories.api';
import { AccessoriesEffectsPresenter } from './accessories-effects.presenter';

@Injectable()
export class AccessoriesFacade {
  private api = inject(AccessoriesApi);
  private effects = inject(AccessoriesEffectsPresenter);

  loading = signal(false);
  error = signal('');

  slot = signal<AccessorySlot>('amulet');
  items = signal<AccessoryItem[]>([]);
  q = signal('');

  private elementsSearchText(it: AccessoryItem): string {
    const els = Array.isArray(it.elements) ? it.elements : [];
    return els
      .filter((e) => Number(e?.value) !== 0)
      .map((e) => `${e.name} ${e.value}`)
      .join(' ');
  }

  filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    let list = this.items();

    if (query) {
      list = list.filter((it) => {
        const name = (it.name ?? '').toLowerCase();
        const code = (it.code ?? '').toLowerCase();
        const effText = this.effects.effectsSearchText(it).toLowerCase();
        const elemText = this.elementsSearchText(it).toLowerCase();
        const lv = String(it.level ?? 0);
        return (
          name.includes(query) ||
          code.includes(query) ||
          effText.includes(query) ||
          elemText.includes(query) ||
          lv.includes(query)
        );
      });
    }

    return list;
  });

  setSlot(slot: AccessorySlot) {
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
          elements: Array.isArray(x.elements) ? x.elements : [],
          effects: Array.isArray(x.effects) ? x.effects : [],
        }));
        this.items.set(normalized);
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar accessories');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
