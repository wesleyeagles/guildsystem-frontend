// src/app/pages/items/ui/items-toolbar.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ItemCategory } from '../../../api/items.api';

export type ItemsToolbarFilters = {
  q: string;
  category: ItemCategory | null;
};

@Component({
  standalone: true,
  selector: 'app-items-toolbar',
  imports: [CommonModule, FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <div class="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
        <div>
          <div class="text-xl sm:text-2xl font-extrabold tracking-tight" style="color: var(--text)">{{ 'items.pageTitle' | transloco }}</div>
          <div class="text-sm text-[var(--muted)]">
            {{ 'items.totalLine' | transloco }} <b class="text-[var(--text-2)]">{{ total }}</b>
          </div>
        </div>

        <div class="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <input
            class="w-full md:w-72 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none"
            [placeholder]="'items.searchToolbar' | transloco"
            [(ngModel)]="q"
            (keydown.enter)="emitFilters()"
          />

          <select
            class="w-full md:w-52 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none"
            [(ngModel)]="category"
            (change)="emitFilters()"
          >
            <option [ngValue]="null">{{ 'items.allCategories' | transloco }}</option>
            @for (c of categories; track c) {
              <option [ngValue]="c">{{ c }}</option>
            }
          </select>

          <button
            class="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] hover:border-[var(--brand-border)]"
            (click)="emitFilters()"
            [disabled]="loading"
          >
            {{ 'items.filter' | transloco }}
          </button>

          <button
            class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-border)]"
            (click)="onClear()"
            [disabled]="loading"
          >
            {{ 'items.clear' | transloco }}
          </button>

          @if (showCreate) {
            <button
              class="rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-[var(--on-brand)] hover:bg-[var(--brand-hover)] hover:border-[var(--brand-hover)]"
              (click)="create.emit()"
              [disabled]="loading"
            >
              {{ 'items.new' | transloco }}
            </button>
          }
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <div class="text-sm text-[var(--muted)]">
          {{ 'items.pageOf' | transloco: { page: page, totalPages: totalPages } }}
        </div>

        <div class="flex items-center gap-2">
          <button
            class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-border)] disabled:opacity-50"
            (click)="prev.emit()"
            [disabled]="loading || page <= 1"
          >
            {{ 'items.prev' | transloco }}
          </button>

          <button
            class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-3)] hover:border-[var(--brand-border)] disabled:opacity-50"
            (click)="next.emit()"
            [disabled]="loading || page >= totalPages"
          >
            {{ 'items.next' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ItemsToolbarComponent {
  @Input() total = 0;
  @Input() loading = false;

  @Input() page = 1;
  @Input() totalPages = 1;

  @Input() categories: readonly ItemCategory[] = [];
  @Input() initialQ = '';
  @Input() initialCategory: ItemCategory | null = null;

  @Input() showCreate = false;

  @Output() filtersChange = new EventEmitter<ItemsToolbarFilters>();
  @Output() clear = new EventEmitter<void>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() create = new EventEmitter<void>();

  q = '';
  category: ItemCategory | null = null;

  ngOnInit() {
    this.q = this.initialQ ?? '';
    this.category = this.initialCategory ?? null;
  }

  emitFilters() {
    this.filtersChange.emit({ q: this.q ?? '', category: this.category ?? null });
  }

  onClear() {
    this.q = '';
    this.category = null;
    this.clear.emit();
  }
}
