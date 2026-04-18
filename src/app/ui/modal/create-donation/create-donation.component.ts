import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DonationsApi, DONATION_OPTIONS } from '../../../api/donations.api';
import { ToastService } from '../../toast/toast.service';

type CreateDonationDialogResult = 'ok' | null;

@Component({
  selector: 'app-create-donation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './create-donation.component.html',
  styleUrl: './create-donation.component.scss',
})
export class CreateDonationComponent {
  private readonly ref = inject(DialogRef<CreateDonationDialogResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly donationsApi = inject(DonationsApi);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly options = DONATION_OPTIONS;
  loading = false;

  readonly form = this.fb.nonNullable.group({
    amount: [25 as 25 | 50 | 100, Validators.required],
  });

  close() {
    this.ref.close(null);
  }

  submit() {
    if (this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(this.transloco.translate('toast.selectAmount'));
      return;
    }

    const amount = this.form.getRawValue().amount as 25 | 50 | 100;
    this.loading = true;

    this.donationsApi
      .create(amount)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('toast.donationSent'));
          this.ref.close('ok');
        },
        error: (err) => {
          const msg = err?.error?.message ?? this.transloco.translate('toast.donationSendFail');
          this.toast.error(msg);
        },
        complete: () => (this.loading = false),
      });
  }
}
