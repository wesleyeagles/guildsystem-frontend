import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { map, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DataTableComponent } from '../../shared/table/data-table.component';
import { createArmorTableConfig } from './armor-table.config';
import { environment } from '../../../environments/environment';

import { ARMOR_SLOTS, ArmorApi, type ArmorPart, type ArmorSlot } from '../../api/armor.api';
import { ArmorEffectsPresenter } from './utils/armor-effects.presenter';
import { ArmorStylePresenter } from './utils/armor-style.presenter';

function safeSlot(v: any): ArmorSlot {
  const s = String(v ?? '').trim().toLowerCase();
  return (ARMOR_SLOTS as readonly string[]).includes(s) ? (s as ArmorSlot) : 'helmet';
}

@Component({
  selector: 'app-armor-table-container',
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  template: `<app-data-table [rowData]="items" [config]="config" />`,
})
export class ArmorTableContainer {
  private route = inject(ActivatedRoute);
  private api = inject(ArmorApi);
  private effects = inject(ArmorEffectsPresenter);
  private style = inject(ArmorStylePresenter);
  private destroyRef = inject(DestroyRef);

  items: ArmorPart[] = [];

  config = createArmorTableConfig(environment.apiUrl, this.style, this.effects);

  constructor() {
    this.route.paramMap
      .pipe(
        map((pm) => safeSlot(pm.get('slot'))),
        distinctUntilChanged(),
        switchMap((slot) => this.api.list(slot)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => (this.items = data ?? []),
        error: (e) => console.error(e),
      });
  }
}
