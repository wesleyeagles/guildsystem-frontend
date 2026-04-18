import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { TranslocoService } from '@jsverse/transloco';
import { EventDefinition, EventsApi } from '../../../api/events.api';
import { ToastService } from '../../toast/toast.service';

type CreateEventDialogResult = 'ok' | null;

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-event.component.html',
  styleUrl: './create-event.component.scss',
})
export class CreateEventComponent {
  private readonly ref = inject(DialogRef<CreateEventDialogResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly eventsApi = inject(EventsApi);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  definitions: EventDefinition[] = [];
  loading = false;

  readonly form = this.fb.nonNullable.group({
    definitionCode: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(3)]],
    durationMinutes: ['15', Validators.required],
    isDoubled: [false],

    // ✅ NOVO
    allowPilot: [false],
    pilotBonusPoints: [''],
  });

  constructor() {
    this.loadDefinitions();

    // ✅ validação dinâmica do bônus
    this.form.controls.allowPilot.valueChanges
      .pipe(startWith(this.form.controls.allowPilot.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((checked) => {
        const ctrl = this.form.controls.pilotBonusPoints;

        if (checked) {
          ctrl.setValidators([Validators.required, Validators.min(1)]);
          if (!String(ctrl.value ?? '').trim()) ctrl.setValue('1');
        } else {
          ctrl.clearValidators();
          ctrl.setValue('');
        }

        ctrl.updateValueAndValidity({ emitEvent: false });
      });
  }

  private loadDefinitions() {
    this.eventsApi
      .definitions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (defs) => {
          this.definitions = (defs ?? []).filter((d) => d.isActive);
          const fallback = this.definitions[0]?.code ?? '';
          if (!this.form.value.definitionCode && fallback) {
            this.form.patchValue({ definitionCode: fallback });
          }
        },
        error: () => this.toast.error(this.transloco.translate('toast.objectivesLoadFail')),
      });
  }

  close() {
    this.ref.close(null);
  }

  submit() {
    if (this.loading) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(this.transloco.translate('toast.fillRequired'));
      return;
    }

    const v = this.form.getRawValue();

    const duration = Number(v.durationMinutes) as 5 | 10 | 15 | 30 | 45 | 60;
    if (![5, 10, 15, 30, 45, 60].includes(duration)) {
      this.toast.error(this.transloco.translate('toast.invalidDuration'));
      return;
    }

    const allowPilot = Boolean(v.allowPilot);
    const bonus = allowPilot ? asInt(v.pilotBonusPoints, 0) : 0;

    if (allowPilot && bonus <= 0) {
      this.toast.error(this.transloco.translate('toast.altPointsMin'));
      return;
    }

    this.loading = true;

    this.eventsApi
      .create({
        definitionCode: v.definitionCode,
        password: v.password,
        durationMinutes: duration,
        isDoubled: v.isDoubled || undefined,
        pilotBonusPoints: allowPilot ? bonus : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('toast.eventCreated'));
          this.ref.close('ok');
        },
        error: () => this.toast.error(this.transloco.translate('toast.eventCreateFail')),
        complete: () => (this.loading = false),
      });
  }
}
