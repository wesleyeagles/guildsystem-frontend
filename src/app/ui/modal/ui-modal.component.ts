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
          <div
            class="w-full max-w-2xl rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xl"
            style="box-shadow: var(--shadow-card)"
          >
            <div
              class="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]"
            >
              <div class="text-base font-semibold text-[var(--text)]">{{ title }}</div>

              <button
                type="button"
                class="px-3 py-2 rounded-[var(--radius)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] transition-colors"
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
              <div
                class="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-[var(--surface-2)]"
              >
                <button
                  type="button"
                  class="px-4 py-2 rounded-[var(--radius)] bg-[var(--surface-3)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-colors"
                  (click)="close.emit()"
                >
                  {{ cancelText }}
                </button>

                @if (confirmTone === 'danger') {
                  <button
                    type="button"
                    class="px-4 py-2 rounded-[var(--radius)] bg-[var(--danger)] hover:brightness-110 border border-[var(--danger)] text-white disabled:opacity-50"
                    [disabled]="confirmDisabled"
                    (click)="confirm.emit()"
                  >
                    {{ confirmText }}
                  </button>
                } @else {
                  <button
                    type="button"
                    class="px-4 py-2 rounded-[var(--radius)] bg-[var(--brand)] hover:bg-[var(--brand-hover)] border border-[var(--brand)] text-[var(--on-brand)] disabled:opacity-50"
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
