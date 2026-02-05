import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

export type ConfirmDeleteData = {
  title: string;
  message: string;
  confirmText?: string;
};

type ConfirmDeleteResult = 'ok' | null;

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-delete.dialog.html',
  styleUrl: './confirm-delete.dialog.scss',
})
export class ConfirmDeleteDialogComponent {
  private readonly ref = inject(DialogRef<ConfirmDeleteResult>);
  readonly data = inject<ConfirmDeleteData>(DIALOG_DATA);

  close() {
    this.ref.close(null);
  }

  confirm() {
    this.ref.close('ok');
  }
}
