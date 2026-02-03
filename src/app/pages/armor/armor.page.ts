import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { ARMOR_SLOTS, type ArmorPart, type ArmorSlot } from '../../api/armor.api';

import { ArmorFacade } from './armor.facade';
import { createPagination } from './pagination';

import { ArmorToolbarComponent } from './components/armor-toolbar.component';
import { ArmorTableComponent } from './components/armor-table.component';

// reaproveitando seu pager
import { CastsPagerComponent } from '../casts/components/casts-pager.component';

function safeSlot(v: any): ArmorSlot {
  const s = String(v ?? '').trim().toLowerCase();
  return (ARMOR_SLOTS as readonly string[]).includes(s) ? (s as ArmorSlot) : 'helmet';
}

const SLOT_LABEL: Record<ArmorSlot, string> = {
  helmet: 'Helmets',
  upper: 'Upper',
  lower: 'Lower',
  gloves: 'Gloves',
  shoes: 'Shoes',
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, ArmorToolbarComponent, CastsPagerComponent, ArmorTableComponent],
  providers: [ArmorFacade],
  templateUrl: './armor.page.html',
})
export class ArmorPage {
  readonly pageSizes = [8, 15, 20, 25, 30, 35, 50] as const;

  private route = inject(ActivatedRoute);
  readonly facade = inject(ArmorFacade);

  private slotFromRoute = toSignal(
    this.route.paramMap.pipe(
      map((pm) => safeSlot(pm.get('slot'))),
      distinctUntilChanged(),
    ),
    { initialValue: 'helmet' as ArmorSlot },
  );

  title = computed(() => SLOT_LABEL[this.facade.slot()]);

  private pager = createPagination<ArmorPart>({
    source: () => this.facade.filtered(),
    pageSizes: this.pageSizes,
    initialPageSize: 8,
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
