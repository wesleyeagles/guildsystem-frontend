import { Component, computed, effect, inject, signal, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EventInstance, EventsApi } from '../../../api/events.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../../ui/toast/toast.service';
import { EventToastManager } from '../../../events/event-toast.manager';
import { EventCanceledPayload, EventCreatedPayload, EventsSocketService } from '../../../events/events-socket.service';

import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';

type Tab = 'active' | 'ended' | 'cancelled' | 'all';

function nowMs() { return Date.now(); }
function ended(ev: EventInstance) { return new Date(ev.expiresAt).getTime() <= nowMs(); }
function cancelled(ev: EventInstance) { return Boolean((ev as any).isCanceled) || Boolean(ev.canceledAt); }
function active(ev: EventInstance) { return !cancelled(ev) && !ended(ev); }

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiSpinnerComponent, DataTableComponent],
  templateUrl: './events-public.page.html',
  styleUrl: './events-public.page.scss',
})
export class EventsPublicPage implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private manager = inject(EventToastManager);
  private socket = inject(EventsSocketService);

  tab = signal<Tab>('all');

  list = signal<EventInstance[]>([]);
  loading = signal(false);
  error = signal('');

  submittingId = signal<number | null>(null);
  rowErrorId = signal<number | null>(null);
  rowError = signal('');

  private controls = new Map<number, FormControl<string>>();

  private gridApi?: GridApi<EventInstance>;
  tableConfig!: DataTableConfig<EventInstance>;

  private onCanceledRef = (p: EventCanceledPayload) => this.onCanceled(p);
  private onCreatedRef = (p: EventCreatedPayload) => this.onCreated(p);

  constructor() {
    this.tableConfig = this.buildTableConfig();

    this.load();

    this.socket.onEventCanceled(this.onCanceledRef);
    this.socket.onEventCreated(this.onCreatedRef);

    effect(() => {
      this.submittingId();
      this.rowErrorId();
      this.rowError();
      this.tab();
      this.gridApi?.refreshCells({ force: true });
    });
  }

  ngOnDestroy() {
    this.socket.offEventCanceled(this.onCanceledRef);
    this.socket.offEventCreated(this.onCreatedRef);
  }

  endDate(ev: EventInstance) {
    const d = new Date(ev.expiresAt);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
  }

  isActive(ev: EventInstance) { return active(ev); }
  isCancelled(ev: EventInstance) { return cancelled(ev); }

  isClaimed(ev: EventInstance) {
    return Boolean(ev.claimedByMe) || this.manager.isClaimed(ev.id);
  }

  pw(id: number) {
    let c = this.controls.get(id);
    if (!c) {
      c = new FormControl('', { nonNullable: true, validators: [Validators.required] });
      this.controls.set(id, c);
    }
    return c;
  }

  filtered = computed(() => {
    const t = this.tab();
    const arr = this.list();

    const filteredArr =
      t === 'all'
        ? arr
        : t === 'active'
          ? arr.filter(active)
          : t === 'ended'
            ? arr.filter((e) => !cancelled(e) && ended(e))
            : arr.filter(cancelled);

    return [...filteredArr].sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  });

  private buildTableConfig(): DataTableConfig<EventInstance> {
    const colDefs: ColDef<EventInstance>[] = [
      {
        headerName: 'Status',
        colId: 'status',
        width: 120,
        sortable: true,
        valueGetter: (p) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';
          if (this.isCancelled(ev)) return 'Cancelado';
          if (this.isActive(ev)) return 'Ativo';
          return 'Finalizado';
        },
        cellRenderer: (p: any) => {
          const v = String(p.value ?? '');
          const cls =
            v === 'Ativo' ? 'pill pill--active'
              : v === 'Finalizado' ? 'pill pill--done'
                : 'pill pill--canceled';
          return `<span class="${cls}">${v}</span>`;
        },
      },
      {
        headerName: 'Evento',
        field: 'title',
        minWidth: 260,
        flex: 1,
        sortable: true,
        cellRenderer: (p: any) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';

          const title = this.escapeHtml(ev.title ?? '');
          const reason =
            this.isCancelled(ev) && ev.cancelReason ? this.escapeHtml(String(ev.cancelReason)) : '';

          return `
    <div class="ev">
      <div class="ev__title">${title}</div>

      ${reason
              ? `
          <div class="ev__reason">
            <span class="ev__reason-label">Motivo:</span>
            <span class="ev__reason-text" title="${reason}">${reason}</span>
          </div>
        `
              : ''
            }
    </div>
  `;
        },
      },
      {
        headerName: 'Pontos',
        field: 'points',
        width: 110,
        sortable: true,
        cellRenderer: (p: any) => `<span class="points">+${Number(p.value ?? 0)}</span>`,
      },
      {
        headerName: 'Expira',
        colId: 'expiresAt',
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.expiresAt ? new Date(p.data.expiresAt).getTime() : 0),
        valueFormatter: (p) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '—';
          return this.endDate(ev);
        },
        cellClass: 'mono',
      },
      {
        headerName: 'Estado',
        colId: 'state',
        width: 180,
        sortable: false,
        valueGetter: (p) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';
          if (this.isClaimed(ev)) return 'Reivindicado';
          if (this.isActive(ev)) return 'Disponível';
          if (this.isCancelled(ev)) return 'Indisponível';
          return 'Encerrado';
        },
        cellRenderer: (p: any) => {
          const v = String(p.value ?? '');
          if (v === 'Reivindicado') return `<span class="pill pill--claimed">${v}</span>`;
          return `<span class="muted">${v || '—'}</span>`;
        },
      },

      // ✅ AÇÕES (erro na mesma linha)
      {
        headerName: 'Ações',
        colId: 'actions',
        minWidth: 520,
        flex: 1,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          const ev = params.data as EventInstance | undefined;
          if (!ev) return '';

          const wrap = document.createElement('div');
          wrap.className = 'actions';

          const canClaim = this.isActive(ev) && !this.isClaimed(ev);
          if (!canClaim) {
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = '—';
            wrap.appendChild(span);
            return wrap;
          }

          const ctrl = this.pw(ev.id);

          const input = document.createElement('input');
          input.className = 'pw';
          input.placeholder = 'Senha';
          input.value = ctrl.value ?? '';

          const btn = document.createElement('button');
          btn.className = 'btn-claim';
          btn.type = 'button';

          const err = document.createElement('span');
          err.className = 'row-err';

          const render = () => {
            const isSubmitting = this.submittingId() === ev.id;

            input.disabled = isSubmitting;
            btn.disabled = isSubmitting || ctrl.invalid;

            btn.textContent = isSubmitting ? '...' : 'Reivindicar';

            const showErr = this.rowErrorId() === ev.id && !!this.rowError();
            err.textContent = showErr ? this.rowError() : '';
            err.style.display = showErr ? 'inline-flex' : 'none';
          };

          input.addEventListener('input', (e: any) => {
            ctrl.setValue(String(e?.target?.value ?? ''));
            ctrl.markAsDirty();
            ctrl.markAsTouched();
            render();
          });

          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            this.claim(ev);
          });

          ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => render());

          wrap.appendChild(input);
          wrap.appendChild(btn);
          wrap.appendChild(err);

          render();
          return wrap;
        },
      },
    ];

    return {
      id: 'events-public',
      colDefs,
      rowHeight: 64,
      quickFilterPlaceholder: 'Buscar...',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<EventInstance>) => {
          this.gridApi = e.api;
        },
      },
    };
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.listAll().subscribe({
      next: (list) => {
        this.list.set(list ?? []);
        this.gridApi?.refreshCells({ force: true });
      },
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar eventos'),
      complete: () => this.loading.set(false),
    });
  }

  claim(ev: EventInstance) {
    if (!active(ev)) return;

    const ctrl = this.pw(ev.id);
    if (ctrl.invalid) return;

    this.submittingId.set(ev.id);
    this.rowErrorId.set(null);
    this.rowError.set('');
    this.gridApi?.refreshCells({ force: true });

    this.api.claim(ev.id, ctrl.value).subscribe({
      next: (r) => {
        this.manager.markClaimed(ev.id);
        this.toast.success(`+${r.pointsAdded} pontos recebidos!`);

        this.list.update((arr) =>
          arr.map((x) => (x.id === ev.id ? { ...x, claimedByMe: true, claimedAt: new Date().toISOString() } : x)),
        );

        ctrl.reset('');
        this.gridApi?.refreshCells({ force: true });
      },
      error: (e) => {
        this.rowErrorId.set(ev.id);
        this.rowError.set(e?.error?.message ?? 'Senha inválida');
        this.submittingId.set(null);
        this.gridApi?.refreshCells({ force: true });
      },
      complete: () => {
        this.submittingId.set(null);
        this.gridApi?.refreshCells({ force: true });
      },
    });
  }

  private onCanceled(p: EventCanceledPayload) {
    this.list.update((arr) =>
      arr.map((x) => {
        if (x.id !== p.id) return x;
        return {
          ...x,
          isCanceled: true,
          canceledAt: p.canceledAt,
          cancelReason: p.reason ?? x.cancelReason ?? null,
          claimedByMe: false,
          claimedAt: null,
          claimReversedAt: p.canceledAt,
        };
      }),
    );

    if (this.submittingId() === p.id) this.submittingId.set(null);
    if (this.rowErrorId() === p.id) {
      this.rowErrorId.set(null);
      this.rowError.set('');
    }

    this.controls.get(p.id)?.reset('');
    this.gridApi?.refreshCells({ force: true });
  }

  private onCreated(p: EventCreatedPayload) {
    const createdAt = new Date().toISOString();

    this.list.update((arr) => {
      const idx = arr.findIndex((x) => x.id === p.id);

      const nextItem: EventInstance = {
        id: p.id,
        title: p.title,
        points: p.points,
        expiresAt: p.expiresAt,
        createdAt,

        isCanceled: false,
        canceledAt: null,
        cancelReason: null,

        claimedByMe: false,
        claimedAt: null,
        claimReversedAt: null,
      };

      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], ...nextItem };
        return copy;
      }

      return [nextItem, ...arr];
    });

    this.gridApi?.refreshCells({ force: true });
  }

  private escapeHtml(s: string) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
