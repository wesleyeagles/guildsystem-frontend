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
        class="inline-block rounded-full border-2 border-slate-700 border-t-slate-200 animate-spin"
        [style.width.px]="size"
        [style.height.px]="size"
      ></span>
      @if (text) {
        <span class="text-sm text-slate-300">{{ text }}</span>
      }
    </div>
  `,
})
export class UiSpinnerComponent {
  @Input() size = 18;
  @Input() text: string | null = null;
  @Input() muted = true;
}
