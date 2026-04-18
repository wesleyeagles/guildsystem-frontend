import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { CommonModule } from '@angular/common';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { Dialog } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DataTableComponent } from '../../shared/table/data-table.component';
import { EventCategory, EventDefinition, EventsApi } from '../../api/events.api';
import { ToastService } from '../../ui/toast/toast.service';
import { DataTableConfig } from '../../shared/table/table.types';
import { headerT } from '../../shared/table/table-i18n';
import { EditObjectiveDialogComponent } from '../../ui/modal/edit-objective/edit-objective.dialog';
import { ConfirmDeleteData, ConfirmDeleteDialogComponent } from '../../ui/modal/confirm-delete/confirm-delete.dialog';

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './objectives.page.html',
  styleUrl: './objectives.page.scss',
})
export class ObjectivesComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(EventsApi);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);
  private readonly transloco = inject(TranslocoService);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  definitions: EventDefinition[] = [];
  definitionsLoading = signal(true);
  creating = false;

  private gridApi?: GridApi<EventDefinition>;
  tableConfig!: DataTableConfig<EventDefinition>;

  readonly categories: EventCategory[] = ['CW', 'GENERIC'];

  // ✅ controle para não sobrescrever o que o usuário digitou no code
  private codeManuallyEdited = false;

  readonly createForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(32)]],
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    points: [0, [Validators.required, Validators.min(0), Validators.max(999999)]],
    category: ['GENERIC' as EventCategory, Validators.required],
    isActive: [true],
  });

  constructor() {
    this.tableConfig = this.buildTableConfig();

    effect(() => {
      this.langTick();
      this.tableConfig = this.buildTableConfig();
      queueMicrotask(() => this.gridApi?.setGridOption('columnDefs', this.tableConfig.colDefs));
    });

    this.loadDefinitions();
    this.setupAutoCodeFromTitle();
    this.setupDetectManualCodeEdit();
  }

  private buildTableConfig(): DataTableConfig<EventDefinition> {
    const loc =
      this.transloco.getActiveLang() === 'pt-BR'
        ? 'pt-BR'
        : this.transloco.getActiveLang() === 'ru'
          ? 'ru-RU'
          : 'en-US';
    const colDefs: ColDef<EventDefinition>[] = [
      { field: 'code', width: 140, sortable: true, ...headerT(this.transloco, 'objectives.col.code') },
      {
        field: 'title',
        flex: 1,
        minWidth: 220,
        sortable: true,
        ...headerT(this.transloco, 'objectives.col.title'),
      },
      { field: 'points', width: 90, sortable: true, ...headerT(this.transloco, 'dashboard.col.points') },
      { field: 'category', width: 110, sortable: true, ...headerT(this.transloco, 'objectives.col.category') },
      {
        field: 'isActive',
        ...headerT(this.transloco, 'objectives.col.active'),
        width: 90,
        sortable: true,
        cellRenderer: (p: any) =>
          p.value
            ? `<span class="pill pill--on">${this.transloco.translate('common.yes')}</span>`
            : `<span class="pill pill--off">${this.transloco.translate('common.no')}</span>`,
      },
      {
        field: 'createdAt',
        ...headerT(this.transloco, 'objectives.col.createdAt'),
        width: 170,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt) : null),
        valueFormatter: (p) =>
          p.value instanceof Date && !isNaN(p.value.getTime()) ? p.value.toLocaleString(loc) : '-',
      },
      {
        colId: 'actions',
        ...headerT(this.transloco, 'common.actions'),
        width: 180,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellStyle: { justifyContent: 'center' },
        cellRenderer: (params: any) => {
          const it = params.data as EventDefinition | undefined;
          if (!it) return '';

          const wrap = document.createElement('div');
          wrap.className = 'actions-cell';

          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-edit';
          editBtn.textContent = this.transloco.translate('common.edit');
          editBtn.addEventListener('click', () => this.openEdit(it));

          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-del';
          delBtn.textContent = this.transloco.translate('common.delete');
          delBtn.addEventListener('click', () => this.openDelete(it));

          wrap.appendChild(editBtn);
          wrap.appendChild(delBtn);
          return wrap;
        },
      },
    ];

    return {
      id: 'objectives',
      colDefs,
      rowHeight: 70,
      quickFilterPlaceholderKey: 'common.search',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<EventDefinition>) => {
          this.gridApi = e.api;
        },
      },
    };
  }

  private loadDefinitions() {
    this.definitionsLoading.set(true);
    this.api
      .definitions()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.definitionsLoading.set(false)),
      )
      .subscribe({
        next: (data) => (this.definitions = data ?? []),
        error: () => this.toast.error(this.transloco.translate('toast.objectivesLoadFail')),
      });
  }

  // ✅ gera slug do título: "Concluir meta diária" -> "concluir_meta_diaria"
  private slugifyToCode(input: string): string {
    return (input ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, '')  // remove chars estranhos
      .replace(/\s+/g, '_')           // espaços -> _
      .replace(/_+/g, '_')            // _ repetido
      .slice(0, 32);                  // limite do campo
  }

  private setupAutoCodeFromTitle() {
    const titleCtrl = this.createForm.controls.title;

    titleCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((title) => {
        if (this.codeManuallyEdited) return;

        const auto = this.slugifyToCode(title);
        // evita loop de valueChanges
        this.createForm.controls.code.setValue(auto, { emitEvent: false });
      });
  }

  private setupDetectManualCodeEdit() {
    const codeCtrl = this.createForm.controls.code;

    codeCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((code) => {
        // Se o usuário apagar tudo, destrava (volta a auto gerar pelo title)
        if (!code || !code.trim()) {
          this.codeManuallyEdited = false;
          return;
        }

        // Se o usuário mexeu no campo de code manualmente, trava
        // Observação: valueChanges também roda quando a gente seta valor por código,
        // mas a gente usa emitEvent:false quando auto gera, então aqui reflete o usuário.
        this.codeManuallyEdited = true;
      });
  }

  createDefinition() {
    if (this.creating) return;

    if (this.createForm.invalid) {
      this.toast.error(this.transloco.translate('toast.fillRequired'));
      this.createForm.markAllAsTouched();
      return;
    }

    this.creating = true;
    const v = this.createForm.getRawValue();

    this.api
      .createDefinition({
        code: v.code.trim(),
        title: v.title.trim(),
        points: Number(v.points),
        category: v.category,
        isActive: v.isActive,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('toast.objectiveCreated'));
          this.createForm.patchValue({ code: '', title: '', points: 0, category: 'GENERIC', isActive: true });

          // ✅ volta para auto-gerar (já que limpou o code)
          this.codeManuallyEdited = false;

          this.loadDefinitions();
        },
        error: () => this.toast.error(this.transloco.translate('toast.objectiveCreateFail')),
        complete: () => (this.creating = false),
      });
  }

  private openEdit(def: EventDefinition) {
    const ref = this.dialog.open(EditObjectiveDialogComponent, { data: def });
    ref.closed.subscribe((result) => {
      if (result === 'ok') this.loadDefinitions();
    });
  }

  private openDelete(def: EventDefinition) {
    const ref = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        title: this.transloco.translate('objectives.deleteTitle'),
        message: this.transloco.translate('objectives.deleteMessage', {
          title: def.title,
          code: def.code,
        }),
        confirmText: this.transloco.translate('common.delete'),
      } satisfies ConfirmDeleteData,
    });

    ref.closed.subscribe((result) => {
      if (result === 'ok') {
        this.api
          .deleteDefinition(def.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.toast.success(this.transloco.translate('toast.objectiveDeleted'));
              this.loadDefinitions();
            },
            error: () => this.toast.error(this.transloco.translate('toast.objectiveDeleteFail')),
          });
      }
    });
  }
}
