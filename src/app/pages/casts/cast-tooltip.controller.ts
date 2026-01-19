import { Injectable, signal } from '@angular/core';
import type { Cast } from '../../api/casts.api';
import type { TipPos } from './casts.types';

@Injectable()
export class CastTooltipController {
  tipCast = signal<Cast | null>(null);
  tipPos = signal<TipPos>({ x: 0, y: 0 });

  private closeTimer: any = null;

  open(ev: MouseEvent, it: Cast) {
    this.cancelClose();
    this.tipCast.set(it);

    const el = ev.currentTarget as HTMLElement | null;
    if (!el) {
      this.tipPos.set({ x: 12, y: 12 });
      return;
    }

    const rect = el.getBoundingClientRect();

    // Mantive os mesmos valores
    const TIP_W = 560;
    const TIP_H_EST = 560;

    const vw = (globalThis as any)?.innerWidth ?? 1024;
    const vh = (globalThis as any)?.innerHeight ?? 768;

    let x = rect.right + 12;
    if (x + TIP_W + 12 > vw) x = Math.max(12, rect.left - TIP_W - 12);

    let y = rect.top - 8;
    if (y + TIP_H_EST + 12 > vh) y = Math.max(12, vh - TIP_H_EST - 12);
    if (y < 12) y = 12;

    this.tipPos.set({ x: Math.floor(x), y: Math.floor(y) });
  }

  scheduleClose() {
    this.cancelClose();
    this.closeTimer = setTimeout(() => this.close(), 120);
  }

  cancelClose() {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  close() {
    this.cancelClose();
    this.tipCast.set(null);
  }
}
