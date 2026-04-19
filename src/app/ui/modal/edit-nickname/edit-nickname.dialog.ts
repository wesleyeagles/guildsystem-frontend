import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UsersApi, API_BASE, type SafeUser } from '../../../api/users.api';
import { ToastService } from '../../toast/toast.service';
import { CharacterClassPickerComponent } from '../../character-class-picker/character-class-picker.component';
import { isValidGameClassSlug } from '../../../data/game-classes';
import { memberAvatarUrl } from '../../../utils/discord-avatar';
import { AuthService } from '../../../auth/auth.service';

export type EditNicknameData = {
  currentNickname: string;
  currentCharacterClass: string;
  profileAvatar: string | null;
  discordId: string | null;
  discordAvatar: string | null;
  discordDiscriminator: string | null;
};
export type EditNicknameResult = { user: SafeUser } | null;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe, CharacterClassPickerComponent],
  templateUrl: './edit-nickname.dialog.html',
  styleUrl: './edit-nickname.dialog.scss',
})
export class EditNicknameDialogComponent {
  private readonly ref = inject(DialogRef<EditNicknameResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);

  readonly data = inject<EditNicknameData>(DIALOG_DATA);
  loading = false;

  readonly profileAvatar = signal<string | null>(this.data.profileAvatar ?? null);
  readonly avatarUploading = signal(false);
  readonly avatarRemoving = signal(false);

  readonly avatarPreviewUrl = computed(() =>
    memberAvatarUrl(
      {
        profileAvatar: this.profileAvatar(),
        discordId: this.data.discordId,
        discordAvatar: this.data.discordAvatar,
        discordDiscriminator: this.data.discordDiscriminator,
      },
      API_BASE,
      128,
    ),
  );

  readonly hasCustomAvatar = computed(() => !!this.profileAvatar());

  readonly form = this.fb.nonNullable.group({
    nickname: [this.data.currentNickname || '', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
    characterClass: [
      isValidGameClassSlug(this.data.currentCharacterClass) ? this.data.currentCharacterClass : '',
      [Validators.required],
    ],
  });

  close() {
    this.ref.close(null);
  }

  onAvatarSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const okType = /^image\/(jpeg|png|webp)$/i.test(file.type);
    if (!okType) {
      this.toast.error(this.transloco.translate('editProfile.avatarInvalidType'));
      return;
    }

    this.avatarUploading.set(true);
    this.api
      .uploadMyProfileAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.profileAvatar.set(user.profileAvatar ?? null);
          this.auth.setSafeUser(user);
          this.toast.success(this.transloco.translate('toast.avatarUpdated'));
        },
        error: (e) => {
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.avatarUploadFail'));
        },
        complete: () => this.avatarUploading.set(false),
      });
  }

  removeAvatar() {
    if (!this.hasCustomAvatar()) {
      return;
    }

    this.avatarRemoving.set(true);
    this.api
      .clearMyProfileAvatar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.profileAvatar.set(user.profileAvatar ?? null);
          this.auth.setSafeUser(user);
          this.toast.success(this.transloco.translate('toast.avatarRemoved'));
        },
        error: (e) => {
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.avatarRemoveFail'));
        },
        complete: () => this.avatarRemoving.set(false),
      });
  }

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

    const nickSame = nick === (this.data.currentNickname || '').trim();
    const clsSame = characterClass === (this.data.currentCharacterClass || '').trim();
    if (nickSame && clsSame) {
      this.close();
      return;
    }

    this.loading = true;
    this.api
      .updateMyProfile({ nickname: nick, characterClass })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.toast.success(this.transloco.translate('toast.profileUpdated'));
          this.ref.close({ user });
        },
        error: (e) => {
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.profileUpdateFail'));
        },
        complete: () => (this.loading = false),
      });
  }
}
