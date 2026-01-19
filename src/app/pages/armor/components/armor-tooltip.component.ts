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

import { API_BASE, type ArmorPart } from '../../../api/armor.api';
import type { TipPos } from '../armor.types';
import { ArmorEffectsPresenter } from '../armor-effects.presenter';
import { ArmorStylePresenter } from '../armor-style.presenter';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-armor-tooltip',
  templateUrl: './armor-tooltip.component.html',
})
export class ArmorTooltipComponent implements AfterViewInit, OnChanges, OnDestroy {
  private effects = inject(ArmorEffectsPresenter);
  private styles = inject(ArmorStylePresenter);

  @Input({ required: true }) item!: ArmorPart;
  @Input({ required: true }) pos!: TipPos;

  @Output() mouseEnter = new EventEmitter<void>();
  @Output() mouseLeave = new EventEmitter<void>();

  @ViewChild('panel', { static: false }) panel?: ElementRef<HTMLElement>;

  safePos: TipPos = { x: 0, y: 0 };

  private readonly margin = 12;
  private readonly offset = 12;
  private raf = 0;

  private readonly onResize = () => this.scheduleReposition();

  ngAfterViewInit(): void {
    this.scheduleReposition();
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pos']) this.scheduleReposition();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  nameClass(it: ArmorPart) {
    return this.styles.nameClass(it);
  }

  displayEffects(it: ArmorPart) {
    return this.effects.displayEffects(it);
  }

  fmt(e: any) {
    return this.effects.formatEffectValue(e);
  }

  private scheduleReposition(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
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

    let x = this.pos.x;
    let y = this.pos.y;

    x = Math.min(Math.max(this.margin, x), w - rect.width - this.margin);

    if (y + rect.height + this.margin > h) y = y - rect.height - this.offset;

    y = Math.min(Math.max(this.margin, y), h - rect.height - this.margin);

    this.safePos = { x, y };
  }
}
