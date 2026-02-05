import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UsersApi, type SafeUser } from '../../api/users.api';
import { ToastService } from '../../ui/toast/toast.service';

import { DataTableComponent } from '../../shared/table/data-table.component';
import type { DataTableConfig } from '../../shared/table/table.types';

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './pending-members.page.html',
  styleUrl: './pending-members.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingMembersPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(UsersApi);
  private readonly toast = inject(ToastService);

  list = signal<SafeUser[]>([]);
  loading = signal(false);
  error = signal('');

  acceptingId = signal<number | null>(null);

  private gridApi?: GridApi<SafeUser>;
  tableConfig!: DataTableConfig<SafeUser>;

  fmtDateTimePtBR = fmtDateTimePtBR;

  constructor() {
    this.tableConfig = this.buildTableConfig();
    this.load();
  }

  private buildTableConfig(): DataTableConfig<SafeUser> {
    const colDefs: ColDef<SafeUser>[] = [
      {
        headerName: 'Nickname',
        field: 'nickname',
        minWidth: 240,
        flex: 1,
        sortable: true,
        cellRenderer: (p: any) => `<span class="nick">${p.value ?? '-'}</span>`,
      },
      {
        headerName: 'Email',
        field: 'email' as any,
        minWidth: 360,
        flex: 2,
        sortable: true,
        cellRenderer: (p: any) => `<span class="email">${p.value ?? '-'}</span>`,
      },
      {
        headerName: 'Criado em',
        field: 'createdAt' as any,
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt as any) : null),
        valueFormatter: (p) =>
          p.value instanceof Date && !isNaN(p.value.getTime()) ? fmtDateTimePtBR(p.value) : '—',
        cellClass: 'mono',
      },
      {
        headerName: 'Ação',
        colId: 'actions',
        width: 150,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellStyle: { justifyContent: 'center' },
        cellRenderer: (params: any) => {
          const u = params.data as SafeUser | undefined;
          if (!u) return '';

          const btn = document.createElement('button');
          btn.className = 'btn-accept';
          btn.type = 'button';

          const render = () => {
            const isLoading = this.loading();
            const isAccepting = this.acceptingId() === u.id;

            btn.disabled = isLoading || isAccepting;
            btn.textContent = isAccepting ? '...' : 'Aceitar';
          };

          // primeira renderização
          render();

          btn.addEventListener('click', () => {
            // proteção extra
            if (btn.disabled) return;
            this.accept(u);
          });

          return btn;
        },
      },
    ];

    return {
      id: 'pending-members',
      colDefs,
      rowHeight: 52,
      quickFilterPlaceholder: 'Buscar por nickname, email ou id...',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<SafeUser>) => {
          this.gridApi = e.api;
        },
      },
    };
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api
      .pending()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (arr) => {
          this.list.set(arr ?? []);
          this.gridApi?.refreshCells({ force: true });
        },
        error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar pendentes'),
        complete: () => {
          this.loading.set(false);
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }

  accept(u: SafeUser) {
    // evita cliques duplos
    if (this.acceptingId() === u.id) return;

    this.acceptingId.set(u.id);
    this.gridApi?.refreshCells({ force: true });

    this.api
      .accept(u.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(`Usuário ${u.nickname} aceito!`);
          this.list.update((arr) => arr.filter((x) => x.id !== u.id));
          this.gridApi?.refreshCells({ force: true });
        },
        error: (e) => this.toast.error(e?.error?.message ?? 'Falha ao aceitar usuário'),
        complete: () => {
          this.acceptingId.set(null);
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }
}
