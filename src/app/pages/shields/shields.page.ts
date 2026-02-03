import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ShieldApi } from '../../api/shields.api';

import { ShieldsFacade } from './shields.facade';
import { createPagination } from './pagination';

// componentes
import { ShieldsToolbarComponent } from './components/shields-toolbar.component';
import { ShieldsTableComponent } from './components/shields-table.component';

// pager reaproveitado
import { CastsPagerComponent } from '../casts/components/casts-pager.component';

@Component({
  standalone: true,
  imports: [CommonModule, ShieldsToolbarComponent, CastsPagerComponent, ShieldsTableComponent],
  providers: [ShieldsFacade],
  templateUrl: './shields.page.html',
})
export class ShieldsPage {
  readonly pageSizes = [8, 15, 20, 25, 30, 35, 50] as const;

  readonly facade = inject(ShieldsFacade);

  title = computed(() => 'Shields');

  private pager = createPagination<ShieldApi>({
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
      // auto-load (igual armor)
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
