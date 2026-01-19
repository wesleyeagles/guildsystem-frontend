import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { API_BASE, Cast } from '../../api/casts.api';

import type { CastTypeFilter } from './casts.types';
import { CastsFacade } from './casts.facade';
import { CastTooltipController } from './cast-tooltip.controller';
import { CastEffectsPresenter } from './cast-effects.presenter';
import { createPagination } from './pagination';

import { CastsToolbarComponent } from './components/casts-toolbar.component';
import { CastsPagerComponent } from './components/casts-pager.component';
import { CastsTableComponent } from './components/casts-table.component';
import { CastTooltipComponent } from './components/cast-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, CastsToolbarComponent, CastsPagerComponent, CastsTableComponent, CastTooltipComponent],
  providers: [CastsFacade, CastTooltipController],
  templateUrl: './casts.page.html',
})
export class CastsPage {
  readonly typeTabs: { label: string; value: CastTypeFilter }[] = [
    { label: 'Todos', value: 'All' },
    { label: 'Buff', value: 'Buff' },
    { label: 'Debuff', value: 'Debuff' },
    { label: 'ForceAttack', value: 'ForceAttack' },
    { label: 'Skill', value: 'Skill' },
  ];

  readonly pageSizes = [10, 15, 20, 25, 30, 35, 50] as const;

  readonly facade = inject(CastsFacade);
  readonly effects = inject(CastEffectsPresenter);
  private readonly tooltip = inject(CastTooltipController);

  private readonly pager = createPagination<Cast>({
    source: () => this.facade.filtered(),
    pageSizes: this.pageSizes,
    initialPageSize: 10,
  });

  // bindings pro template
  loading = this.facade.loading;
  error = this.facade.error;
  q = this.facade.q;
  selectedType = this.facade.selectedType;
  filtered = this.facade.filtered;

  page = this.pager.page;
  pageSize = this.pager.pageSize;
  totalPages = this.pager.totalPages;
  paged = this.pager.paged;

  tipCast = this.tooltip.tipCast;
  tipPos = this.tooltip.tipPos;

  constructor() {
    this.load();
  }

  load() {
    this.tooltip.close();
    this.facade.load();
    this.pager.reset();
  }

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  countByType(t: CastTypeFilter) {
    return this.facade.countByType(t);
  }

  onChangeType(v: CastTypeFilter) {
    this.facade.setType(v);
    this.pager.reset();
    this.tooltip.close();
  }

  onChangeQuery(v: string) {
    this.facade.setQuery(v);
    this.pager.reset();
    this.tooltip.close();
  }

  onChangePageSize(size: number) {
    this.pager.setPageSize(size);
    this.tooltip.close();
  }

  prevPage() {
    this.pager.prev();
    this.tooltip.close();
  }

  nextPage() {
    this.pager.next();
    this.tooltip.close();
  }

  openTip(ev: MouseEvent, it: Cast) {
    this.tooltip.open(ev, it);
  }

  scheduleCloseTip() {
    this.tooltip.scheduleClose();
  }

  cancelCloseTip() {
    this.tooltip.cancelClose();
  }
}
