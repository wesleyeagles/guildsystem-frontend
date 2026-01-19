import { Injectable, signal } from '@angular/core';
import type { ArmorPart } from '../../api/armor.api';
import type { TipPos } from './armor.types';

@Injectable()
export class ArmorTooltipController {
  tipItem = signal<ArmorPart | null>(null);
  tipPos = signal<TipPos>({ x: 0, y: 0 });

  private closeTimer: any = null;

  open(ev: MouseEvent, it: ArmorPart) {
    this.cancelClose();
    this.tipItem.set(it);

    const el = ev.currentTarget as HTMLElement | null;
    if (!el) {
      this.tipPos.set({ x: 12, y: 12 });
      return;
    }

    const rect = el.getBoundingClientRect();

    const TIP_W = 750;
    const TIP_H_EST = 520;

    const vw = window.innerWidth ?? 1024;
    const vh = window.innerHeight ?? 768;

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
    this.tipItem.set(null);
  }
}
