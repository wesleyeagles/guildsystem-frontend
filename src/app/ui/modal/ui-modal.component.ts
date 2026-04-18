import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'ui-modal',
  styles: [
    `
      .ui-modal-shell {
        padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
          max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
        box-sizing: border-box;
        min-height: 0;
      }

      .ui-modal-panel {
        min-height: 0;
        max-height: min(
          92dvh,
          calc(100svh - 2rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))
        );
      }

      .ui-modal-scroll {
        -webkit-overflow-scrolling: touch;
        overflow-x: hidden;
      }
    `,
  ],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50">
        <!-- backdrop -->
        <div class="absolute inset-0 bg-black/60" (click)="backdropClose ? close.emit() : null"></div>

        <!-- dialog -->
        <div
          class="ui-modal-shell absolute inset-0 flex items-center justify-center"
        >
          <div
            class="ui-modal-panel w-full max-w-2xl flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xl mx-3 sm:mx-4"
            style="box-shadow: var(--shadow-card)"
          >
            <div
              class="px-4 py-3 sm:px-5 sm:py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-2)] shrink-0"
            >
              <div class="text-sm sm:text-base font-semibold text-[var(--text)] min-w-0 pr-2">{{ title }}</div>

              <button
                type="button"
                class="px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] transition-colors shrink-0"
                (click)="close.emit()"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div class="ui-modal-scroll p-4 sm:p-5 overflow-y-auto min-h-0 flex-1">
              <ng-content />
            </div>

            @if (showFooter) {
              <div
                class="px-4 py-3 sm:px-5 sm:py-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 bg-[var(--surface-2)] shrink-0"
              >
                <button
                  type="button"
                  class="px-4 py-2 min-h-[44px] rounded-[var(--radius)] bg-[var(--surface-3)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-colors w-full sm:w-auto"
                  (click)="close.emit()"
                >
                  {{ cancelText }}
                </button>

                @if (confirmTone === 'danger') {
                  <button
                    type="button"
                    class="px-4 py-2 min-h-[44px] rounded-[var(--radius)] bg-[var(--danger)] hover:brightness-110 border border-[var(--danger)] text-white disabled:opacity-50 w-full sm:w-auto"
                    [disabled]="confirmDisabled"
                    (click)="confirm.emit()"
                  >
                    {{ confirmText }}
                  </button>
                } @else {
                  <button
                    type="button"
                    class="px-4 py-2 min-h-[44px] rounded-[var(--radius)] bg-[var(--brand)] hover:bg-[var(--brand-hover)] border border-[var(--brand)] text-[var(--on-brand)] disabled:opacity-50 w-full sm:w-auto"
                    [disabled]="confirmDisabled"
                    (click)="confirm.emit()"
                  >
                    {{ confirmText }}
                  </button>
                }
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
  /** `danger`: ações destrutivas (ex.: excluir). `primary`: ouro do tema (Salvar, etc.). */
  @Input() confirmTone: 'primary' | 'danger' = 'primary';

  @Input() backdropClose = true;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
