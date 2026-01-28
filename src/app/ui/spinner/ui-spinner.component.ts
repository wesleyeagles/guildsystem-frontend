// src/app/ui/spinner/ui-spinner.component.ts
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-spinner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center gap-2" [class.opacity-80]="muted">
      <span
        class="ui-spin"
        [style.width.px]="size"
        [style.height.px]="size"
        aria-hidden="true"
      ></span>

      @if (text) {
        <span class="text-sm" style="color: var(--text-2)">{{ text }}</span>
      }
    </div>
  `,
  styles: [
    `
      .ui-spin {
        display: inline-block;
        border-radius: 999px;
        border: 2px solid rgba(148, 163, 184, 0.35);
        border-top-color: var(--brand);
        animation: uiSpin 0.75s linear infinite;
      }

      @keyframes uiSpin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class UiSpinnerComponent {
  @Input() size = 18;
  @Input() text: string | null = null;
  @Input() muted = true;
}
