import { Component, DestroyRef, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { DonationsApi, type DonationListItem, type DonationStatus } from '../../api/donations.api';
import { AuthService } from '../../auth/auth.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ToastService } from '../../ui/toast/toast.service';
import { DataTableComponent } from '../../shared/table/data-table.component';
import type { DataTableConfig } from '../../shared/table/table.types';

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent, TranslocoPipe],
  templateUrl: './donations.page.html',
  styleUrl: './donations.page.scss',
})
export class DonationsPage {
  private destroyRef = inject(DestroyRef);
  private api = inject(DonationsApi);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  loading = signal(false);
  page = signal(1);
  pageSize = signal(20);
  statusFilter = signal<DonationStatus | ''>('');
  total = signal(0);
  totalPages = signal(1);
  items = signal<DonationListItem[]>([]);

  canApprove = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'admin' || s === 'root';
  });

  approving = signal<Record<number, boolean>>({});
  rejecting = signal<Record<number, boolean>>({});

  empty = computed(() => !this.loading() && (this.items()?.length ?? 0) === 0);

  private gridApi?: GridApi<DonationListItem>;
  tableConfig!: DataTableConfig<DonationListItem>;

  constructor() {
    this.tableConfig = this.buildTableConfig();
    effect(() => {
      this.langTick();
      this.tableConfig = this.buildTableConfig();
      queueMicrotask(() => this.gridApi?.setGridOption('columnDefs', this.tableConfig.colDefs));
    });
    this.load();
  }

  private buildTableConfig(): DataTableConfig<DonationListItem> {
    const loc =
      this.transloco.getActiveLang() === 'pt-BR'
        ? 'pt-BR'
        : this.transloco.getActiveLang() === 'ru'
          ? 'ru-RU'
          : 'en-US';
    const colDefs: ColDef<DonationListItem>[] = [
      {
        headerName: this.transloco.translate('donations.colId'),
        field: 'id',
        width: 80,
        sortable: true,
        filter: false,
      },
      {
        headerName: this.transloco.translate('donations.colUser'),
        width: 160,
        sortable: true,
        valueGetter: (p) => p.data?.user?.nickname ?? '—',
        cellRenderer: (p: any) => `<span class="nick">${p.value ?? '—'}</span>`,
      },
      {
        headerName: this.transloco.translate('donations.colAmount'),
        field: 'amount',
        width: 90,
        sortable: true,
        valueFormatter: (p) =>
          p.data ? `${p.data.amount}${this.transloco.translate('donations.amountSuffix')}` : '—',
      },
      {
        headerName: this.transloco.translate('donations.colPoints'),
        field: 'points',
        width: 100,
        sortable: true,
        valueFormatter: (p) =>
          p.data ? this.transloco.translate('donations.pointsFmt', { n: p.data.points }) : '—',
      },
      {
        headerName: this.transloco.translate('donations.colStatus'),
        field: 'status',
        width: 120,
        sortable: true,
        cellRenderer: (p: any) => {
          const status = p.data?.status as DonationStatus | undefined;
          if (!status) return '—';
          const label = this.transloco.translate(`donations.status.${status}`);
          const cls =
            status === 'pending' ? 'chip chip--pending' : status === 'approved' ? 'chip chip--ok' : 'chip chip--bad';
          return `<span class="${cls}">${label}</span>`;
        },
      },
      {
        headerName: this.transloco.translate('donations.colSentAt'),
        field: 'createdAt',
        width: 160,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt) : null),
        valueFormatter: (p) =>
          p.value instanceof Date && !Number.isNaN(p.value.getTime()) ? p.value.toLocaleString(loc) : '—',
        cellClass: 'mono',
      },
      {
        headerName: this.transloco.translate('donations.colReviewedAt'),
        field: 'reviewedAt',
        width: 160,
        flex: 1,
        sortable: true,
        valueGetter: (p) => (p.data?.reviewedAt ? new Date(p.data.reviewedAt) : null),
        valueFormatter: (p) =>
          p.value instanceof Date && !Number.isNaN(p.value.getTime()) ? p.value.toLocaleString(loc) : '—',
        cellClass: 'mono',
      },
      {
        headerName: this.transloco.translate('donations.colActions'),
        colId: 'actions',
        width: 180,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellStyle: { justifyContent: 'center', gap: '8px' },
        cellRenderer: (params: any) => {
          const it = params.data as DonationListItem | undefined;
          if (!it) return '';

          const wrap = document.createElement('div');
          wrap.className = 'donations-actions-cell';

          const render = () => {
            wrap.innerHTML = '';
            const canDo = this.canApprove();
            const isPending = it.status === 'pending';
            const isBusy = this.approving()[it.id] || this.rejecting()[it.id];
            const isLoading = this.loading();

            if (!canDo || !isPending) {
              wrap.textContent = '—';
              return;
            }

            const btnOk = document.createElement('button');
            btnOk.className = 'btn-donation btn-donation--ok';
            btnOk.type = 'button';
            btnOk.textContent = isBusy ? '...' : this.transloco.translate('donations.approve');
            btnOk.disabled = isBusy || isLoading;

            const btnBad = document.createElement('button');
            btnBad.className = 'btn-donation btn-donation--bad';
            btnBad.type = 'button';
            btnBad.textContent = this.transloco.translate('donations.reject');
            btnBad.disabled = isBusy || isLoading;

            btnOk.addEventListener('click', () => {
              if (btnOk.disabled) return;
              this.approve(it);
            });
            btnBad.addEventListener('click', () => {
              if (btnBad.disabled) return;
              this.reject(it);
            });

            wrap.appendChild(btnOk);
            wrap.appendChild(btnBad);
          };

          render();
          return wrap;
        },
      },
    ];

    return {
      id: 'donations',
      colDefs,
      rowHeight: 52,
      quickFilterPlaceholder: this.transloco.translate('common.search'),
      ui: {
        showSearch: true,
        showChips: false,
        showPager: false,
      },
      pagination: {
        enabled: false,
      },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<DonationListItem>) => {
          this.gridApi = e.api;
        },
      },
    };
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);

    const status = this.statusFilter() || undefined;

    this.api
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        status,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.items.set(r.items ?? []);
          this.total.set(asInt(r.total, 0));
          this.totalPages.set(Math.max(1, asInt(r.totalPages, 1)));
          this.gridApi?.refreshCells({ force: true });
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.donationsLoadFail')),
        complete: () => {
          this.loading.set(false);
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }

  onStatusFilterChange(value: string) {
    this.statusFilter.set(
      (value === 'pending' || value === 'approved' || value === 'rejected' ? value : '') as DonationStatus | ''
    );
    this.page.set(1);
    this.load();
  }

  prevPage() {
    const p = this.page();
    if (p <= 1) return;
    this.page.set(p - 1);
    this.load();
  }

  nextPage() {
    const p = this.page();
    const tp = this.totalPages();
    if (p >= tp) return;
    this.page.set(p + 1);
    this.load();
  }

  approve(it: DonationListItem) {
    if (!this.canApprove() || it.status !== 'pending') return;
    const id = it.id;
    this.approving.update((m) => ({ ...m, [id]: true }));
    this.gridApi?.refreshCells({ force: true });

    this.api
      .approve(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          const pts = asInt(r?.pointsAdded, 0);
          this.toast.success(
            pts
              ? this.transloco.translate('toast.approvedWithPts', { pts })
              : this.transloco.translate('toast.approved'),
          );
          this.load();
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.approveFail')),
        complete: () => {
          this.approving.update((m) => {
            const copy = { ...m };
            delete copy[id];
            return copy;
          });
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }

  reject(it: DonationListItem) {
    if (!this.canApprove() || it.status !== 'pending') return;
    const id = it.id;
    this.rejecting.update((m) => ({ ...m, [id]: true }));
    this.gridApi?.refreshCells({ force: true });

    this.api
      .reject(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('toast.rejected'));
          this.load();
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.rejectFail')),
        complete: () => {
          this.rejecting.update((m) => {
            const copy = { ...m };
            delete copy[id];
            return copy;
          });
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }
}
