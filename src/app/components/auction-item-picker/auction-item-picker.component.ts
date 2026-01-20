import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { AuctionCatalogItem, AuctionItemRef } from '../../services/auction-item-catalog.service';
import { AuctionWeaponSelectComponent } from '../auction-weapon-select/auction-weapon-select.component';
import { AuctionArmorSelectComponent } from '../auction-armor-select/auction-armor-select.component';
import { AuctionAccessorySelectComponent } from '../auction-accessory-select/auction-accessory-select.component';

type UiType = 'Weapon' | 'Armor' | 'Accessory';

@Component({
  selector: 'app-auction-item-picker',
  standalone: true,
  imports: [
    CommonModule,
    AuctionWeaponSelectComponent,
    AuctionArmorSelectComponent,
    AuctionAccessorySelectComponent,
  ],
  template: `
    @if (type === 'Weapon') {
      <app-auction-weapon-select
        [selected]="selected"
        [label]="label"
        [hint]="hint"
        (selectedChange)="selectedChange.emit($event)"
      />
    }

    @if (type === 'Armor') {
      <app-auction-armor-select
        [selected]="selected"
        [label]="label"
        [hint]="hint"
        (selectedChange)="selectedChange.emit($event)"
      />
    }

    @if (type === 'Accessory') {
      <app-auction-accessory-select
        [selected]="selected"
        [label]="label"
        [hint]="hint"
        (selectedChange)="selectedChange.emit($event)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionItemPickerComponent {
  @Input({ required: true }) type: UiType = 'Weapon';

  // compat: pode remover do uso
  @Input() items: AuctionCatalogItem[] = [];

  @Input() selected: AuctionItemRef | null = null;

  @Input() label = 'Item do leilão';
  @Input() hint = '';

  @Output() selectedChange = new EventEmitter<AuctionItemRef | null>();
}
