import { CommonModule } from '@angular/common';
import { CdkConnectedOverlay, CdkOverlayOrigin, Overlay } from '@angular/cdk/overlay';
import { Component, ElementRef, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

import {
  GAME_CLASS_OPTIONS,
  type GameClassOption,
  gameClassPublicPath,
  getGameClassOption,
  isValidGameClassSlug,
} from '../../data/game-classes';

@Component({
  standalone: true,
  selector: 'app-character-class-picker',
  imports: [CommonModule, TranslocoPipe, CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './character-class-picker.component.html',
  styleUrl: './character-class-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CharacterClassPickerComponent),
      multi: true,
    },
  ],
})
export class CharacterClassPickerComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly overlay = inject(Overlay);

  readonly options = GAME_CLASS_OPTIONS;

  protected readonly open = signal(false);
  protected readonly panelWidth = signal(280);
  protected readonly overlayScrollStrategy = this.overlay.scrollStrategies.reposition();

  protected disabled = false;
  protected value: string | null = null;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected selectedOption(): GameClassOption | null {
    return getGameClassOption(this.value);
  }

  protected pathFor(o: GameClassOption): string {
    return gameClassPublicPath(o);
  }

  protected toggle(ev: Event) {
    ev.stopPropagation();
    if (this.disabled) {
      return;
    }
    const next = !this.open();
    if (next) {
      const trigger = this.host.nativeElement.querySelector('.gcp__trigger') as HTMLElement | null;
      const w = Math.ceil(trigger?.getBoundingClientRect().width ?? 0);
      this.panelWidth.set(w > 0 ? w : 280);
    }
    this.open.set(next);
  }

  protected closePanel() {
    this.open.set(false);
  }

  protected pick(id: string) {
    if (this.disabled) {
      return;
    }
    this.value = id;
    this.closePanel();
    this.onChange(id);
    this.onTouched();
  }

  writeValue(v: string | null): void {
    this.value = v && isValidGameClassSlug(v) ? v : null;
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.closePanel();
    }
  }
}
