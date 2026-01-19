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
      (close)="cancel.emit()"
      (confirm)="confirm.emit()"
    >
      <div class="text-slate-200">
        <div class="text-sm text-slate-300">{{ message }}</div>
      </div>
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
