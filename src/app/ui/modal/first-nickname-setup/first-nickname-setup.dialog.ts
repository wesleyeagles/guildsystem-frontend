import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UsersApi, type SafeUser } from '../../../api/users.api';
import { ToastService } from '../../toast/toast.service';
import { CharacterClassPickerComponent } from '../../character-class-picker/character-class-picker.component';
import { isValidGameClassSlug } from '../../../data/game-classes';

export type FirstNicknameSetupData = { currentNickname: string; currentCharacterClass: string };
export type FirstNicknameSetupResult = { user: SafeUser } | null;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, CharacterClassPickerComponent],
  templateUrl: './first-nickname-setup.dialog.html',
  styleUrl: './first-nickname-setup.dialog.scss',
})
export class FirstNicknameSetupDialogComponent {
  private readonly ref = inject(DialogRef<FirstNicknameSetupResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<FirstNicknameSetupData>(DIALOG_DATA);
  loading = false;

  readonly form = this.fb.nonNullable.group({
    nickname: [
      this.data.currentNickname || '',
      [Validators.required, Validators.minLength(1), Validators.maxLength(255)],
    ],
    characterClass: [
      isValidGameClassSlug(this.data.currentCharacterClass) ? this.data.currentCharacterClass : '',
      [Validators.required],
    ],
  });

  submit() {
    if (this.loading) return;
    const raw = this.form.getRawValue();
    const nick = raw.nickname.trim();
    const characterClass = String(raw.characterClass ?? '').trim();
    if (!nick) {
      this.toast.error(this.transloco.translate('toast.nicknameRequired'));
      this.form.controls.nickname.markAsTouched();
      return;
    }
    if (!isValidGameClassSlug(characterClass)) {
      this.toast.error(this.transloco.translate('toast.classRequired'));
      this.form.controls.characterClass.markAsTouched();
      return;
    }

    this.loading = true;
    this.api
      .completeSiteSetup({ nickname: nick, characterClass })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.toast.success(this.transloco.translate('toast.setupWelcome'));
          this.ref.close({ user });
        },
        error: (e) => {
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.setupSaveFail'));
        },
        complete: () => (this.loading = false),
      });
  }
}
