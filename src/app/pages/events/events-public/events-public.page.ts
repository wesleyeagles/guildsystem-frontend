import { Component, computed, effect, inject, signal, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { EventInstance, EventsApi } from '../../../api/events.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { EventToastManager } from '../../../events/event-toast.manager';
import {
  EventCanceledPayload,
  EventCreatedPayload,
  EventsSocketService,
} from '../../../events/events-socket.service';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';

type Tab = 'active' | 'ended' | 'cancelled' | 'all';

const TZ_BRASILIA = 'America/Sao_Paulo';

function nowMs() {
  return Date.now();
}

function ended(ev: EventInstance) {
  return new Date(ev.expiresAt).getTime() <= nowMs();
}
function cancelled(ev: EventInstance) {
  return Boolean((ev as any).isCanceled) || Boolean((ev as any).canceledAt);
}
function active(ev: EventInstance) {
  return !cancelled(ev) && !ended(ev);
}

@Component({
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent, DataTableComponent, TranslocoPipe],
  templateUrl: './events-public.page.html',
  styleUrl: './events-public.page.scss',
})
export class EventsPublicPage implements OnDestroy {
  private api = inject(EventsApi);
  private manager = inject(EventToastManager);
  private socket = inject(EventsSocketService);
  private transloco = inject(TranslocoService);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  tab = signal<Tab>('all');

  list = signal<EventInstance[]>([]);
  loading = signal(false);
  error = signal('');

  private gridApi?: GridApi<EventInstance>;
  tableConfig!: DataTableConfig<EventInstance>;

  // ✅ agora o service retorna função "off"
  private offCreated: (() => void) | null = null;
  private offCanceled: (() => void) | null = null;

  constructor() {
    this.tableConfig = this.buildTableConfig();

    effect(() => {
      this.langTick();
      this.tableConfig = this.buildTableConfig();
      queueMicrotask(() => this.gridApi?.setGridOption('columnDefs', this.tableConfig.colDefs));
    });

    this.load();

    // ✅ garante conexão
    this.socket.connect();

    // ✅ guarda unsubscribe
    this.offCanceled = this.socket.onEventCanceled((p) => this.onCanceled(p));
    this.offCreated = this.socket.onEventCreated((p) => this.onCreated(p));

    // refresh ao trocar tab ou quando claim/cancel acontecer via toast
    effect(() => {
      this.tab();
      this.manager.version();
      this.gridApi?.refreshCells({ force: true });
    });
  }

  ngOnDestroy() {
    this.offCanceled?.();
    this.offCreated?.();
    this.offCanceled = null;
    this.offCreated = null;
    // opcional: manter socket conectado globalmente (normal)
    // this.socket.disconnect();
  }

  endDate(ev: EventInstance) {
    return this.fmtDateTime(ev.expiresAt);
  }

  private fmtDateTime(isoOrDate: any) {
    if (!isoOrDate) return '—';
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '—';

    const lang = this.transloco.getActiveLang();
    const loc = lang === 'pt-BR' ? 'pt-BR' : lang === 'ru' ? 'ru-RU' : 'en-US';

    const date = new Intl.DateTimeFormat(loc, {
      timeZone: TZ_BRASILIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

    const time = new Intl.DateTimeFormat(loc, {
      timeZone: TZ_BRASILIA,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);

    return `${date} ${time}`;
  }

  isActive(ev: EventInstance) {
    return active(ev);
  }
  isCancelled(ev: EventInstance) {
    return cancelled(ev);
  }

  isClaimed(ev: EventInstance) {
    return Boolean((ev as any).claimedByMe) || this.manager.isClaimed(ev.id);
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

    return [...filteredArr].sort(
      (a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime(),
    );
  });

  private buildTableConfig(): DataTableConfig<EventInstance> {
    const colDefs: ColDef<EventInstance>[] = [
      {
        headerName: this.transloco.translate('eventsPublic.colStatus'),
        colId: 'status',
        width: 120,
        sortable: true,
        valueGetter: (p) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';
          if (this.isCancelled(ev)) return 'cancelled';
          if (this.isActive(ev)) return 'active';
          return 'ended';
        },
        cellRenderer: (p: any) => {
          const k = String(p.value ?? '');
          if (!k) return '—';
          const cls =
            k === 'active'
              ? 'pill pill--active'
              : k === 'ended'
                ? 'pill pill--done'
                : 'pill pill--canceled';
          const label = this.transloco.translate(`eventsPublic.statusRow.${k}`);
          return `<span class="${cls}">${label}</span>`;
        },
      },
      {
        headerName: this.transloco.translate('eventsPublic.colEvent'),
        field: 'title',
        minWidth: 260,
        flex: 1,
        sortable: true,
        cellRenderer: (p: any) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';

          const title = this.escapeHtml((ev as any).title ?? '');
          const reason =
            this.isCancelled(ev) && (ev as any).cancelReason
              ? this.escapeHtml(String((ev as any).cancelReason))
              : '';
          const reasonLbl = this.escapeHtml(this.transloco.translate('eventsPublic.reasonLabel'));

          return `
            <div class="ev">
              <div class="ev__title">${title}</div>

              ${
                reason
                  ? `
                    <div class="ev__reason">
                      <span class="ev__reason-label">${reasonLbl}</span>
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
        headerName: this.transloco.translate('eventsPublic.colPoints'),
        field: 'points',
        width: 110,
        sortable: true,
        cellRenderer: (p: any) => `<span class="points">+${Number(p.value ?? 0)}</span>`,
      },
      {
        headerName: this.transloco.translate('eventsPublic.colExpires'),
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
        headerName: this.transloco.translate('eventsPublic.colState'),
        colId: 'state',
        width: 180,
        sortable: false,
        valueGetter: (p) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';
          if (this.isClaimed(ev)) return 'claimed';
          if (this.isActive(ev)) return 'available';
          if (this.isCancelled(ev)) return 'unavailable';
          return 'closed';
        },
        cellRenderer: (p: any) => {
          const k = String(p.value ?? '');
          if (!k) return '—';
          const label = this.transloco.translate(`eventsPublic.stateRow.${k}`);
          if (k === 'claimed') return `<span class="pill pill--claimed">${label}</span>`;
          return `<span class="muted">${label}</span>`;
        },
      },
      {
        headerName: this.transloco.translate('eventsPublic.colActions'),
        colId: 'actions',
        width: 160,
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

          const btn = document.createElement('button');
          btn.className = 'btn-claim';
          btn.type = 'button';
          btn.textContent = this.transloco.translate('eventsPublic.claim');

          btn.addEventListener('click', () => this.openClaimToast(ev));

          wrap.appendChild(btn);
          return wrap;
        },
      },
    ];

    return {
      id: 'events-public',
      colDefs,
      rowHeight: 64,
      quickFilterPlaceholder: this.transloco.translate('common.search'),
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
      error: (e) => this.error.set(e?.error?.message ?? this.transloco.translate('eventsPublic.loadError')),
      complete: () => this.loading.set(false),
    });
  }

  openClaimToast(ev: EventInstance) {
    if (!active(ev)) return;
    if (this.isClaimed(ev)) return;

    this.manager.open({
      id: ev.id,
      title: String((ev as any).title ?? ''),
      points: Number((ev as any).points ?? 0) || 0,
      pilotBonusPoints: Number((ev as any).pilotBonusPoints ?? 0) || 0,
      expiresAt: ev.expiresAt,
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
          cancelReason: p.reason ?? (x as any).cancelReason ?? null,
          claimedByMe: false,
          claimedAt: null,
          claimReversedAt: p.canceledAt,
        };
      }),
    );

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
        pilotBonusPoints: (p as any).pilotBonusPoints ?? 0,
        expiresAt: p.expiresAt,
        createdAt,

        isCanceled: false,
        canceledAt: null,
        cancelReason: null,

        claimedByMe: false,
        claimedAt: null,
        claimReversedAt: null,
      } as any;

      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], ...nextItem } as any;
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
