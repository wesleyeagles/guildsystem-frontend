import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';


import { DataTableComponent } from '../../shared/table/data-table.component';
import { createWeaponTableConfig } from './weapon-table.config';
import { Weapon, WeaponsApi } from '../../api/weapons.api';
import { WeaponEffectsPresenter } from './utils/weapon-effects.presenter';
import { WeaponStylePresenter } from './utils/weapon-style.presenter';
import { environment } from '../../../environments/environment';


@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  template: `<app-data-table [rowData]="weapons" [config]="config" />`,
})
export class WeaponsTableContainer {
  private api = inject(WeaponsApi);
  private effects = inject(WeaponEffectsPresenter);
  private style = inject(WeaponStylePresenter);

  weapons: Weapon[] = [];

  config = createWeaponTableConfig(environment.apiUrl, this.style, this.effects);

  constructor() {
    this.api.list().subscribe({
      next: (data) => (this.weapons = data ?? []),
      error: (e) => console.error(e),
    });
  }
}
