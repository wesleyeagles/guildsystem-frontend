import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventCategory, EventDefinition, EventsApi } from '../../../api/events.api';
import { ToastService } from '../../toast/toast.service';


type EditObjectiveResult = 'ok' | null;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-objective.dialog.html',
  styleUrl: './edit-objective.dialog.scss',
})
export class EditObjectiveDialogComponent {
  private readonly ref = inject(DialogRef<EditObjectiveResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(EventsApi);
  private readonly toast = inject(ToastService);

  readonly def = inject<EventDefinition>(DIALOG_DATA);

  readonly categories: EventCategory[] = ['CW', 'GENERIC'];
  saving = false;

  readonly form = this.fb.nonNullable.group({
    title: [this.def.title, [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    points: [this.def.points, [Validators.required, Validators.min(0), Validators.max(999999)]],
    category: [this.def.category, Validators.required],
    isActive: [this.def.isActive],
  });

  close() {
    this.ref.close(null);
  }

  save() {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Corrija os campos.');
      return;
    }

    this.saving = true;
    const v = this.form.getRawValue();

    this.api
      .updateDefinition(this.def.id, {
        title: v.title.trim(),
        points: Number(v.points),
        category: v.category,
        isActive: v.isActive,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Objetivo atualizado!');
          this.ref.close('ok');
        },
        error: () => this.toast.error('Não foi possível atualizar.'),
        complete: () => (this.saving = false),
      });
  }
}
