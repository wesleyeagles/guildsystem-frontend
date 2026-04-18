import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { EventLogItemDto, LogsApi } from '../../api/logs.api';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';
import { DataTableComponent } from '../../shared/table/data-table.component';
import { ToastService } from '../../ui/toast/toast.service';
import type { DataTableConfig } from '../../shared/table/table.types';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../auth/auth.service';

type Tab = 'all' | 'active' | 'reversed';

const TZ_BRASILIA = 'America/Sao_Paulo';

function asInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isReversed(row: EventLogItemDto) {
  return Boolean(row.reversedAt);
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiSpinnerComponent, DataTableComponent, TranslocoPipe],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private api = inject(LogsApi);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private auth = inject(AuthService);

  // ✅ admin/root
  isAdmin = computed(() => {
    const u = this.auth.user();
    return u?.scope === 'admin' || u?.scope === 'root';
  });

  page = signal(1);
  pageSize = signal(50);
  total = signal(0);
  totalPages = signal(1);

  tab = signal<Tab>('all');
  loading = signal(false);
  error = signal('');

  search = new FormControl<string>('', { nonNullable: true });

  list = signal<EventLogItemDto[]>([]);

  submittingClaimId = signal<number | null>(null);
  rowErrorId = signal<number | null>(null);
  rowError = signal('');

  private reasonControls = new Map<number, FormControl<string>>();

  private gridApi?: GridApi<EventLogItemDto>;
  tableConfig!: DataTableConfig<EventLogItemDto>;

  constructor() {
    this.tableConfig = this.buildTableConfig();
    this.load();

    effect(() => {
      this.langTick();
      this.isAdmin();
      this.tableConfig = this.buildTableConfig();
      queueMicrotask(() => this.gridApi?.setGridOption('columnDefs', this.tableConfig.colDefs as any));
      this.gridApi?.refreshCells({ force: true });
    });

    effect(() => {
      this.submittingClaimId();
      this.rowErrorId();
      this.rowError();
      this.tab();
      this.gridApi?.refreshCells({ force: true });
    });

    effect(() => {
      this.tab();
      this.gridApi?.onFilterChanged();
      this.gridApi?.refreshCells({ force: true });
    });
  }

  reasonCtrl(claimId: number) {
    let c = this.reasonControls.get(claimId);
    if (!c) {
      c = new FormControl('', { nonNullable: true });
      this.reasonControls.set(claimId, c);
    }
    return c;
  }

  filtered = computed(() => {
    const t = this.tab();
    const arr = this.list();

    if (t === 'all') return arr;
    if (t === 'reversed') return arr.filter(isReversed);
    return arr.filter((x) => !isReversed(x));
  });

  canPrev = computed(() => this.page() > 1 && !this.loading());
  canNext = computed(() => this.page() < this.totalPages() && !this.loading());

  goPrev() {
    if (!this.canPrev()) return;
    this.page.set(this.page() - 1);
    this.load();
  }

  goNext() {
    if (!this.canNext()) return;
    this.page.set(this.page() + 1);
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    const page = clamp(asInt(this.page(), 1), 1, 1_000_000);
    const pageSize = clamp(asInt(this.pageSize(), 50), 1, 200);
    const q = String(this.search.value ?? '').trim() || undefined;

    this.api.getLogs({ page, pageSize, q }).subscribe({
      next: (res) => {
        this.list.set((res?.items ?? []) as any);
        this.total.set(asInt(res?.total, 0));
        this.totalPages.set(Math.max(1, asInt(res?.totalPages, 1)));
        this.page.set(asInt(res?.page, page));
        this.pageSize.set(asInt(res?.pageSize, pageSize));

        this.gridApi?.refreshCells({ force: true });
        this.gridApi?.onFilterChanged();
      },
      error: (e) => this.error.set(e?.error?.message ?? this.transloco.translate('logs.errLoad')),
      complete: () => this.loading.set(false),
    });
  }

  reverseClaim(row: EventLogItemDto) {
    if (!this.isAdmin()) {
      this.toast.error(this.transloco.translate('logs.noPermission'));
      return;
    }

    if (!row || isReversed(row)) return;

    const claimId = row.claimId;
    const ctrl = this.reasonCtrl(claimId);
    const reason = String(ctrl.value ?? '').trim();

    this.submittingClaimId.set(claimId);
    this.rowErrorId.set(null);
    this.rowError.set('');
    this.gridApi?.refreshCells({ force: true });

    this.api.reverseClaim(claimId, reason ? { reason } : {}).subscribe({
      next: (r) => {
        const pts = Number(r?.pointsReverted ?? 0);
        this.toast.success(
          r?.alreadyReversed
            ? this.transloco.translate('toast.claimAlreadyCancelled')
            : this.transloco.translate('logs.toastReversed', { pts }),
        );

        const reversedAt = r?.reversedAt ?? new Date().toISOString();

        this.list.update((arr) =>
          arr.map((x) =>
            x.claimId === claimId
              ? {
                  ...x,
                  reversedAt,
                  reverseReason: reason || x.reverseReason || null,
                }
              : x,
          ),
        );

        ctrl.reset('');
        this.gridApi?.onFilterChanged();
        this.gridApi?.refreshCells({ force: true });
      },
      error: (e) => {
        this.rowErrorId.set(claimId);
        this.rowError.set(e?.error?.message ?? this.transloco.translate('logs.reverseFail'));
        this.gridApi?.refreshCells({ force: true });
      },
      complete: () => {
        this.submittingClaimId.set(null);
        this.gridApi?.refreshCells({ force: true });
      },
    });
  }

  private buildTableConfig(): DataTableConfig<EventLogItemDto> {
    const colDefs: ColDef<EventLogItemDto>[] = [
      {
        headerName: this.transloco.translate('logs.colStatus'),
        colId: 'status',
        width: 130,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row) return '';
          return isReversed(row) ? 'reversed' : 'active';
        },
        cellRenderer: (p: any) => {
          const k = String(p.value ?? '');
          const label =
            k === 'active'
              ? this.transloco.translate('logs.statusActive')
              : this.transloco.translate('logs.statusReversed');
          const cls = k === 'active' ? 'pill pill--active' : 'pill pill--canceled';
          return `<span class="${cls}">${this.escapeHtml(label)}</span>`;
        },
      },
      {
        headerName: this.transloco.translate('logs.colEvent'),
        colId: 'event',
        width: 120,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row) return '';
          return (
            row.event?.title ??
            this.transloco.translate('logs.eventFallback', { id: String(row.event?.id ?? '') })
          );
        },
        cellRenderer: (p: any) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row) return '';

          const rawTitle =
            row.event?.title ??
            this.transloco.translate('logs.eventFallback', { id: String(row.event?.id ?? '') });
          const title = this.escapeHtml(String(rawTitle ?? ''));

          return `
            <div class="ev">
              <div class="ev__title">${title}</div>
            </div>
          `;
        },
      },

      {
        headerName: this.transloco.translate('logs.col.base'),
        colId: 'basePoints',
        width: 90,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          return asInt(row?.event?.points, 0);
        },
        cellRenderer: (p: any) => `<span class="points">+${Number(p.value ?? 0)}</span>`,
      },

      {
        headerName: this.transloco.translate('logs.col.pilotBonus'),
        colId: 'pilotBonus',
        width: 150,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row) return 0;
          const bonusConfigured = asInt(row.event?.pilotBonusPoints, 0);
          return row.hasPilot ? bonusConfigured : 0;
        },
        cellRenderer: (p: any) => {
          const n = asInt(p.value, 0);
          return `<span class="points points--bonus">+${n}</span>`;
        },
      },

      {
        headerName: this.transloco.translate('logs.col.createdBy'),
        colId: 'createdBy',
        width: 160,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row) return '';
          return row.event?.createdByNickname ?? `#${row.event?.createdByUserId ?? 0}`;
        },
        cellRenderer: (p: any) => `<span class="mono">${this.escapeHtml(String(p.value ?? '—'))}</span>`,
      },
      {
        headerName: this.transloco.translate('logs.col.claimedBy'),
        colId: 'claimedBy',
        width: 180,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row) return '';
          return row.claimedBy?.nickname ?? `#${row.claimedBy?.userId ?? 0}`;
        },
        cellRenderer: (p: any) => `<span class="mono">${this.escapeHtml(String(p.value ?? '—'))}</span>`,
      },
      {
        headerName: this.transloco.translate('logs.col.claimedAt'),
        colId: 'claimedAt',
        width: 190,
        sortable: true,
        valueGetter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row?.claimedAt) return 0;
          return new Date(row.claimedAt).getTime();
        },
        valueFormatter: (p) => {
          const row = p.data as EventLogItemDto | undefined;
          if (!row?.claimedAt) return '—';
          return this.formatLogDateTime(row.claimedAt);
        },
        cellClass: 'mono',
      },
    ];

    if (this.isAdmin()) {
      colDefs.push({
        headerName: this.transloco.translate('logs.colActions'),
        colId: 'actions',
        minWidth: 520,
        flex: 1,
        sortable: false,
        filter: false,
        cellRenderer: (params: any) => {
          const row = params.data as EventLogItemDto | undefined;
          if (!row) return '';

          const wrap = document.createElement('div');
          wrap.className = 'actions';

          if (isReversed(row)) {
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = '—';
            wrap.appendChild(span);
            return wrap;
          }

          const claimId = row.claimId;
          const ctrl = this.reasonCtrl(claimId);

          const input = document.createElement('input');
          input.className = 'reason';
          input.placeholder = this.transloco.translate('logs.reasonPlaceholder');
          input.value = ctrl.value ?? '';

          const btn = document.createElement('button');
          btn.className = 'btn-reverse';
          btn.type = 'button';

          const err = document.createElement('span');
          err.className = 'row-err';

          const render = () => {
            const isSubmitting = this.submittingClaimId() === claimId;

            input.disabled = isSubmitting;
            btn.disabled = isSubmitting;

            btn.textContent = isSubmitting ? '...' : this.transloco.translate('logs.cancelClaim');

            const showErr = this.rowErrorId() === claimId && !!this.rowError();
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
            this.reverseClaim(row);
          });

          ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => render());

          wrap.appendChild(input);
          wrap.appendChild(btn);
          wrap.appendChild(err);

          render();
          return wrap;
        },
      });
    }

    return {
      id: 'event-logs',
      colDefs,
      rowHeight: 72,
      quickFilterPlaceholder: this.transloco.translate('logs.filterPage'),
      ui: {
        showPager: true,
        showSearch: true,
        showChips: true,
      },
      pagination: { enabled: true, autoPageSize: true },
      externalFilter: {
        isPresent: () => this.tab() !== 'all',
        doesPass: (row) => {
          const t = this.tab();
          if (t === 'all') return true;
          if (t === 'reversed') return isReversed(row);
          return !isReversed(row);
        },
      },
      gridOptions: {
        domLayout: 'normal',
        onGridReady: (e: GridReadyEvent<EventLogItemDto>) => {
          this.gridApi = e.api;
        },
      },
    };
  }

  private formatLogDateTime(isoOrDate: any) {
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

  private escapeHtml(s: string) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}