// src/app/pages/items/ui/cast-select.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CastApi, type CastDto, type CastType } from '../../../api/cast.api';

@Component({
  standalone: true,
  selector: 'app-cast-select',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-1 mt-[8px] relative">
      <div class="flex items-center justify-between">
        <label class="text-xs text-slate-400">{{ label }}</label>
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950 overflow-hidden">
        <button
          type="button"
          class="w-full h-[37px] px-3 py-2 text-sm flex items-center justify-between gap-3 hover:bg-slate-900"
          (click)="toggleOpen()"
          [disabled]="disabled"
        >
          <div class="flex items-center gap-2 min-w-0">
            @if (selectedImg()) {
              <img [src]="selectedImg()!" class="w-6 h-6 rounded-md object-cover border border-slate-800" alt="" />
            }
            <div class="min-w-0">
              <div class="text-slate-200 truncate">{{ selectedName() || placeholder }}</div>
            </div>
          </div>

          <div class="text-xs text-slate-500">{{ open() ? '▲' : '▼' }}</div>
        </button>
      </div>

      @if (open()) {
        <div class="fixed inset-0 z-[220]" (click)="closeFromBackdrop($event)">
          <div
            class="absolute z-[221] rounded-md border border-slate-800 bg-slate-950 shadow-xl overflow-hidden"
            [style.left.px]="pos().left"
            [style.top.px]="pos().top"
            [style.width.px]="pos().width"
            (click)="$event.stopPropagation()"
          >
            <div class="p-2 border-b border-slate-800 flex items-center gap-2">
              <input
                class="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
                placeholder="Buscar..."
                [(ngModel)]="q"
                (input)="applyFilter()"
                [disabled]="disabled"
              />

              <button
                type="button"
                class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs hover:bg-slate-900 disabled:opacity-50"
                (click)="reload()"
                [disabled]="disabled || loading()"
              >
                {{ loading() ? '...' : '↻' }}
              </button>
            </div>

            <div class="max-h-[230px] overflow-auto">
              <button
                type="button"
                class="w-full px-3 py-2 text-sm text-left hover:bg-slate-900 flex items-center gap-2"
                (click)="select(null)"
                [disabled]="disabled"
              >
                <div class="text-slate-400">— Nenhum —</div>
              </button>

              @for (c of filtered(); track c.id) {
                <button
                  type="button"
                  class="w-full px-3 py-2 text-sm text-left hover:bg-slate-900 flex items-center gap-2"
                  (click)="select(c)"
                  [disabled]="disabled"
                  [title]="c.name"
                >
                  @if (img(c.imagePath)) {
                    <img
                      [src]="img(c.imagePath)!"
                      class="w-7 h-7 rounded-md object-cover border border-slate-800"
                      alt=""
                    />
                  }
                  <div class="min-w-0">
                    <div class="text-slate-200 truncate">{{ c.name }}</div>
                  </div>
                </button>
              }

              @if (!loading() && filtered().length === 0) {
                <div class="px-3 py-6 text-center text-xs text-slate-500">Nenhum cast encontrado.</div>
              }
            </div>

            @if (error()) {
              <div class="p-2 border-t border-slate-800 text-xs text-red-300">{{ error() }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CastSelectComponent {
  private api = inject(CastApi);

  @Input() label = 'Cast';
  @Input() placeholder = 'Selecione um cast...';
  @Input() disabled = false;

  @Input() type: CastType | null = null;

  @Input() value: number | null = null;
  @Output() valueChange = new EventEmitter<number | null>();

  open = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  casts = signal<CastDto[]>([]);
  filtered = signal<CastDto[]>([]);

  q = '';

  pos = signal({ left: 0, top: 0, width: 0 });

  async ngOnInit() {
    await this.reload();
  }

  private computeAnchorPos() {
    const host = (document.querySelector('app-cast-select:last-of-type') as HTMLElement) || null;
    const el = host ? (host.querySelector('button') as HTMLElement) : null;

    if (!el) return;

    const r = el.getBoundingClientRect();
    const left = r.left;
    const width = r.width;

    const preferBelow = r.bottom + 320 <= window.innerHeight;
    const top = preferBelow ? r.bottom + 6 : Math.max(8, r.top - 6 - 320);

    this.pos.set({
      left,
      top,
      width,
    });
  }

  toggleOpen() {
    if (this.open()) {
      this.open.set(false);
      return;
    }

    this.computeAnchorPos();
    this.applyFilter();
    this.open.set(true);
  }

  closeFromBackdrop(ev: MouseEvent) {
    ev.stopPropagation();
    this.open.set(false);
  }

  async reload() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const list = await firstValueFrom(this.api.list());
      const arr = Array.isArray(list) ? list : [];
      this.casts.set(arr);
      this.applyFilter();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Falha ao carregar casts';
      this.error.set(String(msg));
      this.casts.set([]);
      this.filtered.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    const term = (this.q ?? '').trim().toLowerCase();
    const src = this.casts();

    if (!term) {
      this.filtered.set(src);
      return;
    }

    this.filtered.set(
      src.filter((c) => {
        const name = String(c.name ?? '').toLowerCase();
        const code = String((c as any).code ?? '').toLowerCase();
        return name.includes(term) || code.includes(term);
      }),
    );
  }

  select(c: CastDto | null) {
    this.valueChange.emit(c ? c.id : null);
    this.open.set(false);
  }

  img(path: string | null | undefined) {
    return this.api.resolveImageUrl(path);
  }

  selected() {
    const id = this.value;
    if (!id) return null;
    return this.casts().find((x) => x.id === id) ?? null;
  }

  selectedName() {
    const s = this.selected();
    return s ? s.name ?? null : null;
  }

  selectedImg() {
    const s = this.selected();
    return s ? this.img(s.imagePath) : null;
  }
}
