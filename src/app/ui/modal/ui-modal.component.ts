import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'ui-modal',
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50">
        <!-- backdrop -->
        <div class="absolute inset-0 bg-black/60" (click)="backdropClose ? close.emit() : null"></div>

        <!-- dialog -->
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
            <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div class="text-base font-semibold text-slate-100">{{ title }}</div>

              <button
                class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200"
                (click)="close.emit()"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div class="p-5">
              <ng-content />
            </div>

            @if (showFooter) {
              <div class="px-5 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  class="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200"
                  (click)="close.emit()"
                >
                  {{ cancelText }}
                </button>

                <button
                  class="px-4 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white disabled:opacity-50"
                  [disabled]="confirmDisabled"
                  (click)="confirm.emit()"
                >
                  {{ confirmText }}
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class UiModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() showFooter = false;

  @Input() cancelText = 'Cancelar';
  @Input() confirmText = 'Salvar';
  @Input() confirmDisabled = false;

  @Input() backdropClose = true;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
