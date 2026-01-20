import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-auctions-pager',
  templateUrl: './auctions-pager.component.html',
})
export class AuctionsPagerComponent {
  @Input({ required: true }) page!: number;
  @Input({ required: true }) totalPages!: number;
  @Input({ required: true }) pageSize!: number;
  @Input({ required: true }) pageSizes!: readonly number[];

  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  private toNumber(v: any, fallback = 0) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  onChangeSize(v: any) {
    this.pageSizeChange.emit(this.toNumber(v, 10));
  }
}
