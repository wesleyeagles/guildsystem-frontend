import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { ACCESSORY_SLOTS, type AccessoryItem, type AccessorySlot } from '../../api/accessories.api';

import { AccessoriesFacade } from './accessories.facade';

import { AccessoriesToolbarComponent } from './components/accessories-toolbar.component';
import { AccessoriesTableComponent } from './components/accessories-table.component';

// reaproveitando o pager que você já usa
import { CastsPagerComponent } from '../casts/components/casts-pager.component';

function safeSlot(v: any): AccessorySlot {
  const s = String(v ?? '').trim().toLowerCase();
  return (ACCESSORY_SLOTS as readonly string[]).includes(s) ? (s as AccessorySlot) : 'amulet';
}

const SLOT_LABEL: Record<AccessorySlot, string> = {
  amulet: 'Amulets',
  ring: 'Rings',
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoPipe],
  providers: [AccessoriesFacade],
  templateUrl: './accessories.page.html',
})
export class AccessoriesPage {
  readonly pageSizes = [8, 15, 20, 25, 30, 35, 50] as const;

  private route = inject(ActivatedRoute);
  readonly facade = inject(AccessoriesFacade);

  private slotFromRoute = toSignal(
    this.route.paramMap.pipe(
      map((pm) => safeSlot(pm.get('slot'))),
      distinctUntilChanged(),
    ),
    { initialValue: 'amulet' as AccessorySlot },
  );

  title = computed(() => SLOT_LABEL[this.facade.slot()]);

  loading = this.facade.loading;
  error = this.facade.error;
  q = this.facade.q;
  filtered = this.facade.filtered;

  constructor() {
    effect(() => {
      const slot = this.slotFromRoute();

      if (this.facade.slot() !== slot) {
        this.facade.setSlot(slot);
        this.facade.setQuery('');
      }
    });
  }
}
