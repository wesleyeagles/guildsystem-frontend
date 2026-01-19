import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { ACCESSORY_SLOTS, type AccessoryItem, type AccessorySlot } from '../../api/accessories.api';

import { AccessoriesFacade } from './accessories.facade';
import { createPagination } from '../armor/pagination'; // reaproveita o mesmo arquivo do Armor

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
  imports: [CommonModule, RouterModule, AccessoriesToolbarComponent, CastsPagerComponent, AccessoriesTableComponent],
  providers: [AccessoriesFacade],
  templateUrl: './accessories.page.html',
})
export class AccessoriesPage {
  readonly pageSizes = [9, 15, 20, 25, 30, 35, 50] as const;

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

  private pager = createPagination<AccessoryItem>({
    source: () => this.facade.filtered(),
    pageSizes: this.pageSizes,
    initialPageSize: 9,
  });

  loading = this.facade.loading;
  error = this.facade.error;
  q = this.facade.q;
  filtered = this.facade.filtered;

  page = this.pager.page;
  pageSize = this.pager.pageSize;
  totalPages = this.pager.totalPages;
  paged = this.pager.paged;

  constructor() {
    effect(() => {
      const slot = this.slotFromRoute();

      if (this.facade.slot() !== slot) {
        this.facade.setSlot(slot);
        this.facade.setQuery('');
        this.pager.reset();
      }

      this.load();
    });
  }

  load() {
    this.facade.load();
    this.pager.reset();
  }

  onChangeQuery(v: string) {
    this.facade.setQuery(v);
    this.pager.reset();
  }

  onChangePageSize(size: number) {
    this.pager.setPageSize(size);
  }

  prevPage() {
    this.pager.prev();
  }

  nextPage() {
    this.pager.next();
  }
}
