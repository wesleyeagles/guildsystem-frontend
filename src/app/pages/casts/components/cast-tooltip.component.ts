import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { API_BASE, Cast } from '../../../api/casts.api';
import type { TipPos } from '../casts.types';
import { CastEffectsPresenter } from '../cast-effects.presenter';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-cast-tooltip',
  templateUrl: './cast-tooltip.component.html',
})
export class CastTooltipComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly effects = inject(CastEffectsPresenter);

  @Input({ required: true }) cast!: Cast;
  @Input({ required: true }) pos!: TipPos;

  @Output() mouseEnter = new EventEmitter<void>();
  @Output() mouseLeave = new EventEmitter<void>();

  @ViewChild('panel', { static: false }) panel?: ElementRef<HTMLElement>;

  // posição final ajustada (clamp + flip)
  safePos: TipPos = { x: 0, y: 0 };

  private readonly margin = 12; // distância mínima da borda da viewport
  private readonly offset = 12; // “gap” do cursor/âncora até o tooltip
  private raf = 0;

  private readonly onResize = () => this.scheduleReposition();

  ngAfterViewInit(): void {
    this.scheduleReposition();
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pos']) {
      this.scheduleReposition();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  private scheduleReposition(): void {
    if (this.raf) cancelAnimationFrame(this.raf);

    // espera render/layout do template antes de medir
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.reposition();
    });
  }

  private reposition(): void {
    const el = this.panel?.nativeElement;
    if (!el || !this.pos) {
      this.safePos = this.pos ?? { x: 0, y: 0 };
      return;
    }

    const rect = el.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;

    // começa da posição “crua” recebida
    let x = this.pos.x;
    let y = this.pos.y;

    // clamp horizontal (não deixa sair pra esquerda/direita)
    x = Math.min(Math.max(this.margin, x), w - rect.width - this.margin);

    // se estourar embaixo, “flip” pra cima
    if (y + rect.height + this.margin > h) {
      y = y - rect.height - this.offset;
    }

    // clamp vertical final (não deixa sair por cima/baixo)
    y = Math.min(Math.max(this.margin, y), h - rect.height - this.margin);

    this.safePos = { x, y };
  }
}
