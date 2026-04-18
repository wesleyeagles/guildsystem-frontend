// src/app/ui/emoji-tooltip/ui-emoji-tooltip.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

@Component({
  selector: 'ui-emoji-tooltip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="relative inline-flex items-center" #root>
      <!-- Botão que abre o tooltip -->
      <button
        type="button"
        class="px-2 py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] hover:bg-[var(--surface-3)] flex items-center gap-1"
        [title]="title"
        (click)="toggle($event)"
      >
        <span class="text-[13px]">{{ buttonEmoji }}</span>
        <span class="text-[var(--text-2)]">+</span>
      </button>
    </span>

    @if (open()) {
      <!-- Tooltip FIXED (como ChatGPT) -->
      <div
        class="fixed z-[90] rounded-2xl bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5 shadow-xl"
        [style.left.px]="left()"
        [style.top.px]="top()"
        (pointerdown)="$event.stopPropagation()"
      >
        <div class="flex items-center gap-1">
          @for (e of emojis; track e) {
            <button
              type="button"
              class="w-9 h-9 rounded-xl hover:bg-[var(--surface-3)] flex items-center justify-center text-[18px]"
              (click)="pick(e)"
              [title]="e"
            >
              {{ e }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class UiEmojiTooltipComponent {

  @Input() emojis: string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  @Input() buttonEmoji = '😊';

  @Input() title = 'Reagir';

  @Input() showPlus = true;

  @Output() picked = new EventEmitter<string>();

  @Output() plus = new EventEmitter<void>();

  @ViewChild('root', { static: true }) root!: ElementRef<HTMLElement>;

  open = signal(false);
  left = signal(12);
  top = signal(12);

  toggle(ev?: Event) {
    ev?.stopPropagation();

    if (this.open()) {
      this.close();
      return;
    }

    this.open.set(true);
    this.reposition();
  }

  close() {
    this.open.set(false);
  }

  pick(e: string) {
    this.picked.emit(e);
    this.close();
  }

  private reposition() {
    const host = this.root?.nativeElement;
    const btn = host?.querySelector('button') as HTMLElement | null;
    if (!btn) return;

    const r = btn.getBoundingClientRect();

    // largura aproximada: 40px por botão + padding
    const count = (this.emojis?.length ?? 0) + (this.showPlus ? 1 : 0);
    const approxW = clamp(count * 40 + 16, 160, 420);
    const approxH = 52;

    const margin = 8;

    // tenta abrir acima (como ChatGPT)
    let top = r.top - approxH - 10;
    let left = r.left;

    // se não cabe acima, abre abaixo
    if (top < margin) {
      top = r.bottom + 10;
    }

    // clamp na tela
    left = clamp(left, margin, window.innerWidth - approxW - margin);
    top = clamp(top, margin, window.innerHeight - approxH - margin);

    this.left.set(Math.round(left));
    this.top.set(Math.round(top));
  }

  // Fecha clicando fora
  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.open()) return;

    const host = this.root?.nativeElement;
    const target = ev.target as Node | null;
    if (!host || !target) return;

    // se clicou dentro do botão, deixa o toggle lidar
    if (host.contains(target)) return;

    // clicou fora => fecha
    this.close();
  }

  // Fecha no ESC
  @HostListener('document:keydown.escape')
  onEsc() {
    if (!this.open()) return;
    this.close();
  }

  // Reposiciona se rolar/redimensionar
  @HostListener('window:resize', ['$event'])
  onResize(_ev: UIEvent) {
    if (!this.open()) return;
    this.reposition();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(_ev: Event) {
    if (!this.open()) return;
    this.reposition();
  }
}
