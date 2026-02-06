import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ItemDto } from '../../../api/items.api';
import { ItemTooltipComponent } from './item-tooltip/item-tooltip.component';
import { MatIconModule } from '@angular/material/icon';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

@Component({
  standalone: true,
  selector: 'app-item-card',
  imports: [CommonModule, ItemTooltipComponent, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './item-card.component.scss',
  template: `
    <div class="relative grid grid-cols-1">
      <div
        #anchor
        class="item-card rounded-md border border-slate-800 bg-slate-950 transition"
        [class.hover:border-slate-700]="!hoverActions()"
        (pointerenter)="onEnterCard()"
        (pointerleave)="onLeaveCard()"
        [style.--gradeColor]="gradeColor()"
      >
        <!-- BORDA ANIMADA PERMANENTE + GLOW -->
        <svg
          class="trace"
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <!-- aura/glow (fixa) -->
          <rect
            class="trace-glow"
            x="1"
            y="1"
            width="98"
            height="98"
            rx="6"
            ry="6"
            pathLength="100"
          />

          <!-- cobrinha (animada) -->
          <rect
            class="trace-rect"
            x="1"
            y="1"
            width="98"
            height="98"
            rx="6"
            ry="6"
            pathLength="100"
          />
        </svg>

        <div class="bg-slate-900 flex items-center justify-center relative h-24">
          @if (imgUrl()) {
            <img [src]="imgUrl()!" [alt]="item.name" class="object-cover" loading="lazy" />
          } @else {
            <div class="text-xs text-slate-500">Sem imagem</div>
          }
        </div>

        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-semibold truncate" style="color: var(--text)">{{ item.name }}</div>

              <div class="text-[11px] text-slate-400 truncate">
                @if (item.type) {
                  <span>{{ item.type }}</span>
                } @else {
                  <span>{{ item.category }}</span>
                }
              </div>

              <div class="text-[11px] text-slate-300 whitespace-nowrap">
                @if (item.level !== null && item.level !== undefined) {
                  Lv <b class="text-slate-100">{{ item.level }}</b>
                } @else {
                  <span class="text-slate-500">—</span>
                }
              </div>
            </div>
          </div>

          @if (canEdit) {
            <div
              class="top-2 right-2 flex gap-1 mt-2"
              (pointerenter)="hoverActions.set(true)"
              (pointerleave)="hoverActions.set(false)"
            >
              <button
                type="button"
                class="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-2 text-xs hover:bg-slate-900 flex items-center justify-center"
                (click)="edit.emit(item)"
              >
                <mat-icon aria-hidden="false" fontIcon="edit"></mat-icon>
              </button>

              <button
                type="button"
                class="rounded-md border border-red-900 bg-red-950/40 px-2 py-1 text-xs hover:bg-red-950 flex items-center justify-center"
                (click)="remove.emit(item)"
              >
                <mat-icon aria-hidden="false" fontIcon="delete"></mat-icon>
              </button>
            </div>
          }
        </div>
      </div>

      @if (tooltipOpen()) {
        <div class="fixed inset-0 z-[240] pointer-events-none">
          <div
            class="absolute rounded-md border border-slate-700 bg-slate-950 shadow-2xl"
            [style.left.px]="tooltipPos().left"
            [style.top.px]="tooltipPos().top"
            [style.width.px]="tooltipPos().width"
          >
            <app-item-tooltip [item]="item" [imgUrl]="imgUrl()" />
          </div>
        </div>
      }
    </div>
  `,
})
export class ItemCardComponent {
  private host = inject(ElementRef<HTMLElement>);

  @ViewChild('anchor', { static: true }) anchor!: ElementRef<HTMLElement>;

  @Input({ required: true }) item!: ItemDto;
  @Input() imgResolver: (item: ItemDto) => string | null = () => null;
  @Input() canEdit = false;

  @Output() edit = new EventEmitter<ItemDto>();
  @Output() remove = new EventEmitter<ItemDto>();

  gradeColor() {
    const g = String(this.item?.grade ?? '').toLowerCase();

    if (g.includes('pink')) return '#ec4899';
    if (g.includes('relic')) return '#f59e0b';
    if (g.includes('orange')) return '#fb923c';
    if (g.includes('purple')) return '#a855f7';
    if (g.includes('intense')) return '#60a5fa';

    if (g.includes('rare a')) return '#60a5fa';
    if (g.includes('rare b')) return '#34d399';
    if (g.includes('rare c')) return '#fbbf24';
    if (g.includes('superior')) return '#f87171';

    if (g.includes('normal')) return '#94a3b8';

    return '#22c55e';
  }

  tooltipOpen = signal(false);
  hoverActions = signal(false);

  tooltipPos = signal({ left: 0, top: 0, width: 380 });

  imgUrl() {
    return this.imgResolver(this.item);
  }

  onEnterCard() {
    if (this.hoverActions()) return;
    this.computeTooltipPos();
    this.tooltipOpen.set(true);
  }

  onLeaveCard() {
    this.tooltipOpen.set(false);
  }

  @HostListener('window:scroll')
  onScroll() {
    if (!this.tooltipOpen()) return;
    this.computeTooltipPos();
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.tooltipOpen()) return;
    this.computeTooltipPos();
  }

  private computeTooltipPos() {
    const el = this.anchor?.nativeElement ?? this.host.nativeElement;
    const r = el.getBoundingClientRect();

    const desiredWidth = 380;
    const gap = 10;

    let left = r.right + gap;
    let top = r.top;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const maxLeft = vw - desiredWidth - 8;
    if (left > maxLeft) left = r.left - gap - desiredWidth;

    left = clamp(left, 8, Math.max(8, vw - desiredWidth - 8));

    const maxTop = vh - 260;
    top = clamp(top, 8, Math.max(8, maxTop));

    this.tooltipPos.set({ left, top, width: desiredWidth });
  }
}
