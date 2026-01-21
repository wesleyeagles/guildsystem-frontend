import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { Weapon } from '../../api/weapons.api';

import { WeaponTooltipController } from './utils/weapon-tooltip.controller';
import { WeaponEffectsPresenter } from './utils/weapon-effects.presenter';
import { createPagination } from './pagination';

import { WeaponsToolbarComponent } from './components/weapons-toolbar/weapons-toolbar.component';

import { CastsPagerComponent } from '../casts/components/casts-pager.component';
import { WeaponsTableComponent } from './components/weapons-table/weapons-table.component';
import { WeaponTooltipComponent } from './components/weapon-tooltip/weapon-tooltip.component';
import { WeaponsFacade } from './utils/weapons.facade';

@Component({
  standalone: true,
  imports: [CommonModule, WeaponsToolbarComponent, CastsPagerComponent, WeaponsTableComponent, WeaponTooltipComponent],
  providers: [WeaponsFacade, WeaponTooltipController],
  templateUrl: './weapons.page.html',
})
export class WeaponsPage {
  readonly pageSizes = [9, 15, 20, 25, 30, 35, 50] as const;

  readonly facade = inject(WeaponsFacade);
  readonly effects = inject(WeaponEffectsPresenter);
  private readonly tooltip = inject(WeaponTooltipController);

  private readonly pager = createPagination<Weapon>({
    source: () => this.facade.filtered(),
    pageSizes: this.pageSizes,
    initialPageSize: 9,
  });

  // bindings pro template
  loading = this.facade.loading;
  error = this.facade.error;
  q = this.facade.q;
  filtered = this.facade.filtered;

  page = this.pager.page;
  pageSize = this.pager.pageSize;
  totalPages = this.pager.totalPages;
  paged = this.pager.paged;

  tipWeapon = this.tooltip.tipWeapon;
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

  openTip(ev: MouseEvent, it: Weapon) {
    this.tooltip.open(ev, it);
  }

  scheduleCloseTip() {
    this.tooltip.scheduleClose();
  }

  cancelCloseTip() {
    this.tooltip.cancelClose();
  }
}
