import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Helmet, HelmetEffect } from '../../api/helmets.api';

import { HelmetsFacade } from './helmets.facade';
import { HelmetTooltipController } from './helmet-tooltip.controller';
import { HelmetEffectsPresenter } from './helmet-effects.presenter';
import { createPagination } from './pagination';

import { HelmetsToolbarComponent } from './components/helmets-toolbar.component';
import { HelmetsTableComponent } from './components/helmets-table.component';
import { HelmetTooltipComponent } from './components/helmet-tooltip.component';
import { CastsPagerComponent } from '../casts/components/casts-pager.component';

@Component({
  standalone: true,
  imports: [CommonModule, HelmetsToolbarComponent, CastsPagerComponent, HelmetsTableComponent, HelmetTooltipComponent],
  providers: [HelmetsFacade, HelmetTooltipController],
  templateUrl: './helmets.page.html',
})
export class HelmetsPage {
  readonly pageSizes = [10, 15, 20, 25, 30, 35, 50] as const;

  readonly facade = inject(HelmetsFacade);
  readonly effects = inject(HelmetEffectsPresenter);
  private readonly tooltip = inject(HelmetTooltipController);

  private readonly pager = createPagination<Helmet>({
    source: () => this.facade.filtered(),
    pageSizes: this.pageSizes,
    initialPageSize: 10,
  });

  loading = this.facade.loading;
  error = this.facade.error;
  q = this.facade.q;
  filtered = this.facade.filtered;

  page = this.pager.page;
  pageSize = this.pager.pageSize;
  totalPages = this.pager.totalPages;
  paged = this.pager.paged;

  tipHelmet = this.tooltip.tipHelmet;
  tipPos = this.tooltip.tipPos;

  constructor() {
    this.load();
  }

  load() {
    this.tooltip.close();
    this.facade.load();
    this.pager.reset();
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

  openTip(ev: MouseEvent, it: Helmet) {
    this.tooltip.open(ev, it);
  }

  scheduleCloseTip() {
    this.tooltip.scheduleClose();
  }

  cancelCloseTip() {
    this.tooltip.cancelClose();
  }
}
