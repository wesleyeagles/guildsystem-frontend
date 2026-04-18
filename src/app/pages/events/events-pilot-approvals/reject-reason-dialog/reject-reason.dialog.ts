import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type Data = { claimId: number };
type Result = { ok: true; reason: string | null } | null;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reject-reason.dialog.html',
  styleUrl: './reject-reason.dialog.scss',
})
export class RejectReasonDialogComponent {
  private ref = inject(DialogRef<Result>);
  data = inject<Data>(DIALOG_DATA);
  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    reason: ['', [Validators.maxLength(220)]],
  });

  close() {
    this.ref.close(null);
  }

  submit() {
    const reasonRaw = String(this.form.getRawValue().reason ?? '').trim();
    const reason = reasonRaw.length ? reasonRaw : null;
    this.ref.close({ ok: true, reason });
  }
}
