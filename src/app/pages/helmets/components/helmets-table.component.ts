import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { API_BASE, type Helmet } from '../../../api/helmets.api';
import { HelmetEffectsPresenter } from '../helmet-effects.presenter';
import { HelmetStylePresenter } from '../helmet-style.presenter';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-helmets-table',
  templateUrl: './helmets-table.component.html',
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
export class HelmetsTableComponent {
  private effects = inject(HelmetEffectsPresenter);
  private styles = inject(HelmetStylePresenter);

  @Input({ required: true }) items!: readonly Helmet[];
  @Input() isEmpty = false;

  @Output() enterDetails = new EventEmitter<{ ev: MouseEvent; item: Helmet }>();
  @Output() leaveDetails = new EventEmitter<void>();

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  hasDetails(it: Helmet) {
    return this.effects.hasDetails(it);
  }

  nameClass(it: Helmet) {
    return this.styles.nameClass(it);
  }

  gradeRgb(it: Helmet) {
    return this.styles.gradeRgb(it);
  }

  onEnter(ev: MouseEvent, it: Helmet) {
    this.enterDetails.emit({ ev, item: it });
  }
}
