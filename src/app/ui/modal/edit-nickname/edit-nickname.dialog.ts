import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UsersApi, type SafeUser } from '../../../api/users.api';
import { ToastService } from '../../toast/toast.service';

export type EditNicknameData = { currentNickname: string };
export type EditNicknameResult = { user: SafeUser } | null;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-nickname.dialog.html',
  styleUrl: './edit-nickname.dialog.scss',
})
export class EditNicknameDialogComponent {
  private readonly ref = inject(DialogRef<EditNicknameResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);

  readonly data = inject<EditNicknameData>(DIALOG_DATA);
  loading = false;

  readonly form = this.fb.nonNullable.group({
    nickname: [this.data.currentNickname || '', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
  });

  close() {
    this.ref.close(null);
  }

  submit() {
    if (this.loading) return;
    const nick = this.form.getRawValue().nickname.trim();
    if (!nick) {
      this.toast.error('Informe um nickname.');
      this.form.controls.nickname.markAsTouched();
      return;
    }
    if (nick === (this.data.currentNickname || '').trim()) {
      this.close();
      return;
    }

    this.loading = true;
    this.api
      .updateMyNickname(nick)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.toast.success('Nickname alterado com sucesso.');
          this.ref.close({ user });
        },
        error: (e) => {
          this.toast.error(e?.error?.message ?? 'Falha ao alterar nickname');
        },
        complete: () => (this.loading = false),
      });
  }
}
