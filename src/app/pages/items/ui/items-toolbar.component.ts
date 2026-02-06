// src/app/pages/items/ui/items-toolbar.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { ItemCategory } from '../../../api/items.api';

export type ItemsToolbarFilters = {
  q: string;
  category: ItemCategory | null;
};

@Component({
  standalone: true,
  selector: 'app-items-toolbar',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <div class="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
        <div>
          <div class="text-2xl font-extrabold tracking-tight" style="color: var(--text)">Items</div>
          <div class="text-sm text-slate-400">
            Total: <b class="text-slate-200">{{ total }}</b>
          </div>
        </div>

        <div class="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <input
            class="w-full md:w-72 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
            placeholder="Buscar por nome/descrição..."
            [(ngModel)]="q"
            (keydown.enter)="emitFilters()"
          />

          <select
            class="w-full md:w-52 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
            [(ngModel)]="category"
            (change)="emitFilters()"
          >
            <option [ngValue]="null">Todas categorias</option>
            @for (c of categories; track c) {
              <option [ngValue]="c">{{ c }}</option>
            }
          </select>

          <button
            class="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800"
            (click)="emitFilters()"
            [disabled]="loading"
          >
            Filtrar
          </button>

          <button
            class="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm hover:bg-slate-900"
            (click)="onClear()"
            [disabled]="loading"
          >
            Limpar
          </button>

          @if (showCreate) {
            <button
              class="rounded-xl border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm hover:bg-emerald-950"
              (click)="create.emit()"
              [disabled]="loading"
            >
              + Novo
            </button>
          }
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <div class="text-sm text-slate-400">
          Página <b class="text-slate-200">{{ page }}</b> de <b class="text-slate-200">{{ totalPages }}</b>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm hover:bg-slate-900 disabled:opacity-50"
            (click)="prev.emit()"
            [disabled]="loading || page <= 1"
          >
            Anterior
          </button>

          <button
            class="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm hover:bg-slate-900 disabled:opacity-50"
            (click)="next.emit()"
            [disabled]="loading || page >= totalPages"
          >
            Próxima
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
