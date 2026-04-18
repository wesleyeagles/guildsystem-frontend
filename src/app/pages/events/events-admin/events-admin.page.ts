import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, startWith } from 'rxjs';

import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';

import { EventsApi, type EventInstance, type EventDefinition } from '../../../api/events.api';
import { UsersApi, type SafeUser } from '../../../api/users.api';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CancelReasonDialogComponent } from './cancel-reason-dialog/cancel-reason.dialog';
import { ToastService } from '../../../ui/toast/toast.service';
import {
  EventCanceledPayload,
  EventCreatedPayload,
  EventsSocketService,
} from '../../../events/events-socket.service';

type Status = 'Ativo' | 'Finalizado' | 'Cancelado';

const getStatus = (it: EventInstance): Status => {
  if (it.isCanceled) return 'Cancelado';
  const now = Date.now();
  const expires = it.expiresAt ? new Date(it.expiresAt).getTime() : NaN;
  if (Number.isFinite(expires) && expires <= now) return 'Finalizado';
  return 'Ativo';
};

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent, MatDialogModule, ReactiveFormsModule, TranslocoPipe],
  styleUrl: './events-admin.page.scss',
  templateUrl: './events-admin.page.html',
})
export class EventsAdminPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsApi = inject(EventsApi);
  private readonly userApi = inject(UsersApi);
  private readonly dialog = inject(Dialog);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly eventsSocket = inject(EventsSocketService);

  events: EventInstance[] = [];
  users: SafeUser[] = [];
  definitions: EventDefinition[] = [];

  eventsLoading = signal(true);
  creating = false;

  private gridApi?: GridApi<EventInstance>;
  tableConfig!: DataTableConfig<EventInstance>;

  readonly createForm = this.fb.nonNullable.group({
    definitionCode: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(3)]],
    durationMinutes: ['15', Validators.required], // string
    isDoubled: [false],

    // ✅ NOVO
    allowPilot: [false],
    pilotBonusPoints: [''],
  });

  constructor() {
    const colDefs: ColDef<EventInstance>[] = [
      { headerName: 'Título', field: 'title', width: 190, sortable: true },
      { headerName: 'Pontos', field: 'points', width: 80, sortable: true },

      // ✅ NOVO: coluna pra visualizar
      {
        headerName: 'Piloto',
        colId: 'pilot',
        width: 110,
        sortable: true,
        valueGetter: (p) => asInt((p.data as any)?.pilotBonusPoints ?? 0, 0),
        cellRenderer: (p: any) => {
          const v = asInt(p.value, 0);
          return v > 0 ? `<span class="pill pill--claimed">+${v}</span>` : `<span class="muted">—</span>`;
        },
      },

      {
        headerName: 'Multiplo',
        field: 'isDoubled',
        width: 100,
        sortable: true,
        cellRenderer: (params: any) => `<span>${params.value ? 2 : 1}x</span>`,
      },
      {
        headerName: 'Status',
        colId: 'status',
        minWidth: 140,
        sortable: true,
        valueGetter: (p) => (p.data ? getStatus(p.data) : ''),
        cellRenderer: (p: any) => {
          const v = p.value as Status;
          const cls =
            v === 'Ativo'
              ? 'status-chip--active'
              : v === 'Finalizado'
                ? 'status-chip--done'
                : 'status-chip--canceled';

          return `<span class="status-chip ${cls}">${v}</span>`;
        },
      },
      {
        headerName: 'Criado por',
        field: 'createdByUserId' as any,
        colId: 'createdByUserId',
        width: 140,
        sortable: true,
        cellRenderer: (params: any) => {
          const u = this.getUserById(Number(params.value));
          return `<span>${u?.nickname ?? '-'}</span>`;
        },
      },
      {
        headerName: 'Criado em',
        field: 'createdAt',
        minWidth: 170,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt) : null),
        valueFormatter: (p) =>
          p.value instanceof Date && !isNaN(p.value.getTime()) ? p.value.toLocaleString('pt-BR') : '-',
      },
      {
        headerName: 'Cancelado por',
        field: 'canceledByUserId' as any,
        colId: 'canceledByUserId',
        minWidth: 160,
        sortable: true,
        cellRenderer: (params: any) => {
          const u = this.getUserById(Number(params.value));
          return `<span>${u?.nickname ?? 'N/A'}</span>`;
        },
      },
      {
        headerName: 'Razão do Cancelamento',
        field: 'cancelReason',
        flex: 1,
        sortable: true,
        cellRenderer: (params: any) => `<span>${params.value ?? 'N/A'}</span>`,
      },
      {
        headerName: 'Ações',
        colId: 'actions',
        width: 120,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellStyle: { justifyContent: 'center' },

        cellRenderer: (params: any) => {
          const it = params.data as EventInstance | undefined;
          if (!it || it.isCanceled) return '';

          const btn = document.createElement('button');
          btn.className = 'btn btn-cancel';
          btn.textContent = 'Cancelar';

          btn.addEventListener('click', () => {
            this.openCancelModal(it.id);
          });

          return btn;
        },
      },
    ];

    this.tableConfig = {
      id: 'events-admin',
      colDefs,
      rowHeight: 80,
      pagination: {
        autoPageSize: true,
        enabled: true,
      },
      quickFilterPlaceholder: 'Buscar...',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<EventInstance>) => {
          this.gridApi = e.api;
        },
      },
    };

    this.createForm.controls.allowPilot.valueChanges
      .pipe(startWith(this.createForm.controls.allowPilot.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((checked) => {
        const ctrl = this.createForm.controls.pilotBonusPoints;

        if (checked) {
          ctrl.setValidators([Validators.required, Validators.min(1)]);
          if (!String(ctrl.value ?? '').trim()) ctrl.setValue('1');
        } else {
          ctrl.clearValidators();
          ctrl.setValue('');
        }

        ctrl.updateValueAndValidity({ emitEvent: false });
      });

    this.loadDefinitions();
    this.loadEvents();
    this.loadUsers();
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.eventsSocket.connect();

    const offCreated = this.eventsSocket.onEventCreated((_p: EventCreatedPayload) => {
      this.loadEvents();
    });

    const offCanceled = this.eventsSocket.onEventCanceled((p: EventCanceledPayload) => {
      const idx = this.events.findIndex((e) => e.id === p.id);
      if (idx >= 0) {
        const old = this.events[idx];
        this.events[idx] = {
          ...old,
          isCanceled: true,
          canceledAt: p.canceledAt,
          cancelReason: p.reason ?? null,
        };

        this.events = [...this.events];
        this.gridApi?.refreshCells({ force: true });
      } else {
        this.loadEvents();
      }
    });

    this.destroyRef.onDestroy(() => {
      offCreated();
      offCanceled();
    });
  }

  private loadDefinitions() {
    this.eventsApi
      .definitions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (defs) => {
          this.definitions = (defs ?? []).filter((d) => d.isActive);

          if (!this.createForm.value.definitionCode && this.definitions.length) {
            this.createForm.patchValue({ definitionCode: this.definitions[0].code });
          }
        },
        error: () => this.toast.error(this.transloco.translate('toast.definitionsLoadFail')),
      });
  }

  private loadEvents() {
    this.eventsLoading.set(true);
    this.eventsApi
      .listAdmin()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.eventsLoading.set(false)),
      )
      .subscribe({
        next: (data) => (this.events = data ?? []),
        error: () => this.toast.error(this.transloco.translate('dashboard.errEvents')),
      });
  }

  private loadUsers() {
    this.userApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.users = data ?? [];
          this.gridApi?.refreshCells({
            columns: ['createdByUserId', 'canceledByUserId'],
            force: true,
          });
        },
        error: () => this.toast.error(this.transloco.translate('toast.usersLoadFail')),
      });
  }

  getUserById(id: number): SafeUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  createEvent() {
    if (this.creating) return;

    if (this.createForm.invalid) {
      this.toast.error(this.transloco.translate('toast.fillRequired'));
      this.createForm.markAllAsTouched();
      return;
    }

    const v = this.createForm.getRawValue();

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

    this.creating = true;

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
          this.createForm.patchValue({
            password: '',
            isDoubled: false,
            durationMinutes: '15',
            allowPilot: false,
            pilotBonusPoints: '',
          });

          this.loadEvents();
        },
        error: () => this.toast.error(this.transloco.translate('toast.eventCreateFail')),
        complete: () => (this.creating = false),
      });
  }

  protected openCancelModal(id: number) {
    const ref = this.dialog.open(CancelReasonDialogComponent, { data: id });

    ref.closed.subscribe((result) => {
      if (result === 'ok') {
        this.loadEvents();
      }
    });
  }
}
