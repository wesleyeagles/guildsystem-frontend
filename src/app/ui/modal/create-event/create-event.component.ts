import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventDefinition, EventsApi } from '../../../api/events.api';
import { ToastService } from '../../toast/toast.service';

type CreateEventDialogResult = 'ok' | null;

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

  definitions: EventDefinition[] = [];
  loading = false;

  readonly form = this.fb.nonNullable.group({
    definitionCode: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(3)]],
    durationMinutes: ['15', Validators.required],
    isDoubled: [false],
  });

  constructor() {
    this.loadDefinitions();
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
        error: () => this.toast.error('Falha ao carregar objetivos.'),
      });
  }

  close() {
    this.ref.close(null);
  }

  submit() {
    if (this.loading) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Preencha os campos obrigatórios.');
      return;
    }

    const v = this.form.getRawValue();

    const duration = Number(v.durationMinutes) as 15 | 30 | 45 | 60;
    if (![15, 30, 45, 60].includes(duration)) {
      this.toast.error('Duração inválida.');
      return;
    }

    this.loading = true;

    this.eventsApi
      .create({
        definitionCode: v.definitionCode,
        password: v.password,
        durationMinutes: duration,
        isDoubled: v.isDoubled || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success('Evento criado com sucesso!');
          this.ref.close('ok');
        },
        error: () => this.toast.error('Não foi possível criar o evento.'),
        complete: () => (this.loading = false),
      });
  }
}
