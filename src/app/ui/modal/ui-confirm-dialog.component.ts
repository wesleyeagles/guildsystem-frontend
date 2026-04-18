import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UiModalComponent } from './ui-modal.component';

@Component({
  standalone: true,
  selector: 'ui-confirm-dialog',
  imports: [UiModalComponent],
  template: `
    <ui-modal
      [open]="open"
      [title]="title"
      [showFooter]="true"
      [cancelText]="cancelText"
      [confirmText]="confirmText"
      [confirmDisabled]="confirmDisabled"
      confirmTone="danger"
      (close)="cancel.emit()"
      (confirm)="confirm.emit()"
    >
      <div class="text-sm text-[var(--text-2)]">{{ message }}</div>
    </ui-modal>
  `,
})
export class UiConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirmar';
  @Input() message = 'Tem certeza?';

  @Input() cancelText = 'Cancelar';
  @Input() confirmText = 'Excluir';
  @Input() confirmDisabled = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
