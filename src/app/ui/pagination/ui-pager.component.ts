import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    standalone: true,
    selector: 'ui-pager',
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="flex items-center gap-2">
        @if (canChangePageSize) {
<span class="text-xs text-slate-400">Por página</span>

      <select
        class="px-2 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500 text-sm"
        [value]="pageSize"
        (change)="onChangeSize(($any($event.target).value ?? '10'))"
      >
        @for (s of pageSizes; track s) {
          <option [value]="s">{{ s }}</option>
        }
      </select>
        }
      

      <button
        class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm disabled:opacity-50"
        (click)="prev.emit()"
        [disabled]="page <= 1"
      >
        Prev
      </button>

      <div class="text-xs text-slate-400 whitespace-nowrap">
        Página <span class="text-slate-100">{{ page }}</span> / {{ totalPages }}
      </div>

      <button
        class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm disabled:opacity-50"
        (click)="next.emit()"
        [disabled]="page >= totalPages"
      >
        Next
      </button>
    </div>
  `,
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
