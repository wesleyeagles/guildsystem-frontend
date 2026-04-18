// src/app/pages/items/ui/items-grid.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ItemDto } from '../../../api/items.api';
import { ItemCardComponent } from './item-card.component';

@Component({
  standalone: true,
  selector: 'app-items-grid',
  imports: [CommonModule, ItemCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-3 grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
      @for (it of items; track it.id) {
        <app-item-card
          [item]="it"
          [imgResolver]="imgResolver"
          [canEdit]="canEdit"
          (edit)="edit.emit($event)"
          (remove)="remove.emit($event)"
        />
      }
    </div>
  `,
})
export class ItemsGridComponent {
  @Input() items: ItemDto[] = [];
  @Input() imgResolver: (item: ItemDto) => string | null = () => null;
  @Input() canEdit = false;

  @Output() edit = new EventEmitter<ItemDto>();
  @Output() remove = new EventEmitter<ItemDto>();
}
