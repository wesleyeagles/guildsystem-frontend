import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../../ui/toast/toast.service';
import { EventsApi } from '../../../../api/events.api';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  styleUrl: './cancel-reason.dialog.scss',
  templateUrl: './cancel-reason.dialog.html',
})
export class CancelReasonDialogComponent {
  private ref = inject(DialogRef<'ok' | null>);
  private readonly toast = inject(ToastService);
  private readonly eventsApi = inject(EventsApi);

  readonly id = inject<number>(DIALOG_DATA);

  readonly reason = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(300)] });

  close() {
    this.ref.close(null);
  }

  confirm() {
    if (this.reason.invalid) {
      this.toast.error('O motivo está muito longo.');
      return;
    }

    const value = this.reason.value.trim();
    const payload = value.length ? value : null;

    this.eventsApi.cancel(this.id, payload).subscribe({
      next: () => {
        this.toast.success('Evento cancelado com sucesso!');
        this.ref.close('ok');
      },
      error: () => {
        this.toast.error('Não foi possível cancelar o evento.');
      },
    });
  }
}
