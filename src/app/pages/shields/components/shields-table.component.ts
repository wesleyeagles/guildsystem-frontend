import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { API_BASE, type ShieldApi } from '../../../api/shields.api';
import { ShieldsEffectsPresenter } from '../shield-effects.presenter';
import { ShieldsStylePresenter } from '../shield-style.presenter';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-shields-table',
  templateUrl: './shields-table.component.html',
  styles: [
    `
      @property --a {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
      }

      .wframe {
        --rgb: 148, 163, 184;
        --b: 2px;
        --l: rgba(var(--rgb), 0) 0% 82%,
          rgba(var(--rgb), 0.18) 87%,
          rgba(var(--rgb), 0.95) 90%,
          rgba(var(--rgb), 0.18) 93%,
          rgba(var(--rgb), 0) 100%;

        width: 48px;
        height: 48px;

        box-shadow: 0 0 0 1px rgba(var(--rgb), 0.28), 0 10px 28px rgba(var(--rgb), 0.2);
        border-radius: 14px;

        position: relative;
      }

      tr:hover .wframe {
        box-shadow: 0 0 0 1px rgba(var(--rgb), 0.35), 0 14px 40px rgba(var(--rgb), 0.28);
      }

      .wimg {
        --a: 0deg;

        box-sizing: border-box;
        width: 100%;
        height: 100%;

        border: solid var(--b) transparent;
        border-radius: 14px;

        background: linear-gradient(rgba(2, 6, 23, 0.55), rgba(2, 6, 23, 0.55)) padding-box,
          repeating-conic-gradient(from var(--a, 0deg), var(--l)) border-box;

        filter: url(#glow-1);
        animation: a 2s linear infinite;

        display: block;
      }

      img.wimg {
        object-fit: cover;
      }

      .wimg--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: rgba(148, 163, 184, 0.75);
        user-select: none;
      }

      @keyframes a {
        to {
          --a: 1turn;
        }
      }
    `,
  ],
})
export class ShieldsTableComponent {
  private effects = inject(ShieldsEffectsPresenter);
  private styles = inject(ShieldsStylePresenter);

  @Input({ required: true }) items!: readonly ShieldApi[];
  @Input() isEmpty = false;

  // upgrade +0..+7 no Defense (igual armor)
  readonly upgrades = [0, 1, 2, 3, 4, 5, 6, 7] as const;
  readonly defenseUpgrade = signal<(typeof this.upgrades)[number]>(0);

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  nameClass(it: ShieldApi) {
    return this.styles.nameClass(it);
  }

  gradeRgb(it: ShieldApi) {
    return this.styles.gradeRgb(it);
  }

  fmtEffect(effect: any) {
    return this.effects.formatEffectValue(effect);
  }

  displayEffects(it: ShieldApi) {
    return this.effects.displayEffects(it);
  }

  defUpActive() {
    return this.defenseUpgrade() > 0;
  }

  setDefenseUpgradeFromSelect(v: any) {
    const n = Number(v);
    const safe = this.upgrades.includes(n as any) ? (n as any) : 0;
    this.defenseUpgrade.set(safe);
  }

  private mult(u: number): number {
    const table: Record<number, number> = {
      0: 1.0,
      1: 1.05,
      2: 1.13,
      3: 1.25,
      4: 1.5,
      5: 1.8,
      6: 2.35,
      7: 3.0,
    };
    const key = Math.min(Math.max(Number(u) || 0, 0), 7);
    return table[key] ?? 1.0;
  }

  private toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  displayDefense(it: ShieldApi): number {
    const base = this.toNum(it.defense);
    const m = this.mult(this.defenseUpgrade());
    return Math.floor(base * m);
  }
}
