import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
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
  private readonly transloco = inject(TranslocoService);
  private readonly eventsApi = inject(EventsApi);

  readonly id = inject<number>(DIALOG_DATA);

  readonly reason = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(300)] });

  close() {
    this.ref.close(null);
  }

  confirm() {
    if (this.reason.invalid) {
      this.toast.error(this.transloco.translate('toast.reasonTooLong'));
      return;
    }

    const value = this.reason.value.trim();
    const payload = value.length ? value : null;

    this.eventsApi.cancel(this.id, payload).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('toast.eventCancelledOk'));
        this.ref.close('ok');
      },
      error: () => {
        this.toast.error(this.transloco.translate('toast.eventCancelFail'));
      },
    });
  }
}
