// src/app/ui/pager/ui-pager.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../components/button/button.component';

@Component({
  standalone: true,
  selector: 'ui-pager',
  imports: [CommonModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-pager.component.html',
})
export class UiPagerComponent {
  @Input({ required: true }) page!: number;
  @Input({ required: true }) totalPages!: number;
  @Input({ required: true }) canChangePageSize!: boolean;

  @Input({ required: true }) pageSize!: number;
  @Input({ required: true }) pageSizes!: readonly number[];

  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  onChangeSize(v: string) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    this.pageSizeChange.emit(n);
  }
}
