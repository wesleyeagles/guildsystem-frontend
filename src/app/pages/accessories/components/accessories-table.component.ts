import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { API_BASE, type AccessoryElementName, type AccessoryItem } from '../../../api/accessories.api';
import { AccessoriesEffectsPresenter } from '../accessories-effects.presenter';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-accessories-table',
  templateUrl: './accessories-table.component.html',
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

        filter: url(#glow-acc);
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
export class AccessoriesTableComponent {
  private effects = inject(AccessoriesEffectsPresenter);

  @Input({ required: true }) items!: readonly AccessoryItem[];
  @Input() isEmpty = false;

  readonly elementOrder: readonly AccessoryElementName[] = ['Fire', 'Water', 'Earth', 'Wind'] as const;

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  fmtEffect(effect: any) {
    return this.effects.formatEffectValue(effect);
  }

  displayEffects(it: AccessoryItem) {
    return this.effects.displayEffects(it);
  }

  displayElements(it: AccessoryItem) {
    const arr = Array.isArray(it.elements) ? it.elements : [];
    const map = new Map<string, number>();
    for (const e of arr) map.set(String(e?.name ?? ''), Number(e?.value ?? 0));

    return this.elementOrder
      .map((name) => ({ name, value: Number(map.get(name) ?? 0) }))
      .filter((e) => Number.isFinite(e.value) && e.value !== 0);
  }
}
