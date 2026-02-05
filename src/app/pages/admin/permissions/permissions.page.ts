import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';

import { UsersApi, type Roles, type SafeUser } from '../../../api/users.api';
import { AuthService } from '../../../auth/auth.service';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../../ui/toast/toast.service';

function asStr(v: any) {
  return String(v ?? '').trim();
}

function normRole(v: any): Roles {
  const s = asStr(v);
  if (s === 'none' || s === 'readonly' || s === 'moderator' || s === 'admin' || s === 'root') return s;
  return 'readonly';
}

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './permissions.page.html',
  styleUrl: './permissions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  loading = signal(false);
  error = signal('');

  query = signal('');
  list = signal<SafeUser[]>([]);
  updating = signal<Record<number, boolean>>({});

  private gridApi?: GridApi<SafeUser>;
  tableConfig!: DataTableConfig<SafeUser>;

  readonly me = computed(() => this.auth.userSig());
  readonly myScope = computed(() => (this.me()?.scope ?? null) as Roles | null);

  readonly roles: Roles[] = ['none', 'readonly', 'moderator', 'admin', 'root'];

  fmtDateTimePtBR = fmtDateTimePtBR;

  constructor() {
    this.tableConfig = this.buildTableConfig();
    this.load();
  }

  private buildTableConfig(): DataTableConfig<SafeUser> {
    const colDefs: ColDef<SafeUser>[] = [
      { headerName: 'ID', field: 'id', width: 90, sortable: true },

      { headerName: 'Nickname', field: 'nickname', width: 240, sortable: true },

      { headerName: 'Email', field: 'email' as any, minWidth: 280, flex: 1, sortable: true },

      {
        headerName: 'Status',
        colId: 'status',
        width: 120,
        sortable: true,
        valueGetter: (p) => (p.data?.accepted ? 'Aceito' : 'Pendente'),
        cellRenderer: (p: any) => {
          const ok = p.value === 'Aceito';
          const cls = ok ? 'pill pill--on' : 'pill pill--warn';
          return `<span class="${cls}">${p.value}</span>`;
        },
      },

      {
        headerName: 'Criado',
        field: 'createdAt' as any,
        width: 180,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt as any) : null),
        valueFormatter: (p) =>
          p.value instanceof Date && !isNaN(p.value.getTime()) ? fmtDateTimePtBR(p.value) : '—',
      },

      // Roles
      ...this.roles.map((r) => this.roleCol(r)),
    ];

    return {
      id: 'permissions',
      colDefs,
      rowHeight: 52,
      quickFilterPlaceholder: 'Buscar por nickname, email ou id...',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<SafeUser>) => {
          this.gridApi = e.api;

          // aplica quickFilter inicial se tiver
          const q = asStr(this.query());
          if (q) this.gridApi.setGridOption('quickFilterText', q);
        },
      },
    };
  }

  private roleCol(role: Roles): ColDef<SafeUser> {
    const title =
      role === 'none'
        ? 'Nenhum'
        : role === 'readonly'
          ? 'Membro'
          : role === 'moderator'
            ? 'Moderador'
            : role === 'admin'
              ? 'Admin'
              : 'Root';

    return {
      headerName: title,
      colId: `role_${role}`,
      width: role === 'moderator' ? 130 : 110,
      sortable: false,
      filter: false,
      cellStyle: { justifyContent: 'center' },

      cellRenderer: (params: any) => {
        const u = params.data as SafeUser | undefined;
        if (!u) return '';

        const wrap = document.createElement('div');
        wrap.className = 'cell-center';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = this.isChecked(u, role);
        input.disabled = this.isDisabled(u, role);

        input.addEventListener('change', (ev) => {
          this.toggleRole(u, role, ev as any);

          // re-render geral pra atualizar disabled/checked imediatamente
          // (principalmente porque updating muda e porque roles mudam)
          this.gridApi?.refreshCells({ force: true });
        });

        wrap.appendChild(input);
        return wrap;
      },
    };
  }

  onSearchChange(v: string) {
    const q = asStr(v);
    this.query.set(q);

    // quick filter do ag-grid
    this.gridApi?.setGridOption('quickFilterText', q);
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (arr) => {
          this.list.set(arr ?? []);

          // mantém a tabela atualizada
          // (rowData tá vindo do template via signal, mas a grid pode estar pronta já)
          this.gridApi?.refreshCells({ force: true });

          // reaplica filtro
          const q = asStr(this.query());
          if (q) this.gridApi?.setGridOption('quickFilterText', q);
        },
        error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar usuários'),
        complete: () => this.loading.set(false),
      });
  }

  private canSetRole(actorScope: Roles | null, actorId: number, target: SafeUser, desired: Roles) {
    if (!actorScope) return false;
    if (actorId === target.id) return false;

    const targetScope = normRole((target as any).scope);
    const isTargetRoot = String((target as any).scope) === 'root';

    if (isTargetRoot) return false;
    if (desired === 'root') return false;

    if (actorScope === 'root') {
      return desired === 'none' || desired === 'readonly' || desired === 'moderator' || desired === 'admin';
    }

    if (actorScope === 'admin') {
      if (targetScope === 'admin') return false;
      if (targetScope === 'none') return false;

      const canTouch = targetScope === 'readonly' || targetScope === 'moderator';
      if (!canTouch) return false;

      return desired === 'readonly' || desired === 'moderator';
    }

    return false;
  }

  private canToggleOffModerator(actorScope: Roles | null, actorId: number, target: SafeUser) {
    const targetScope = normRole((target as any).scope);
    if (actorScope !== 'admin') return false;
    if (actorId === target.id) return false;
    if (targetScope !== 'moderator') return false;
    return this.canSetRole(actorScope, actorId, target, 'readonly');
  }

  isChecked(u: SafeUser, r: Roles) {
    return normRole((u as any).scope) === r;
  }

  isDisabled(u: SafeUser, r: Roles) {
    const me = this.me();
    const actorScope = this.myScope();
    const actorId = me?.userId ?? -1;

    if (this.updating()[u.id]) return true;

    const checked = this.isChecked(u, r);

    if (checked) {
      if (r === 'moderator') {
        return !this.canToggleOffModerator(actorScope, actorId, u);
      }
      return true;
    }

    return !this.canSetRole(actorScope, actorId, u, r);
  }

  toggleRole(u: SafeUser, r: Roles, ev: Event) {
    const input = ev?.target as HTMLInputElement | null;
    const checked = Boolean(input?.checked);

    const actorScope = this.myScope();
    const actorId = this.me()?.userId ?? -1;

    const current = normRole((u as any).scope);
    const wanted = normRole(r);

    if (checked) {
      if (this.isDisabled(u, wanted)) return;
      if (current === wanted) return;
      return this.applyRole(u, wanted);
    }

    if (current === 'moderator' && wanted === 'moderator') {
      if (!this.canToggleOffModerator(actorScope, actorId, u)) return;
      return this.applyRole(u, 'readonly');
    }

    return;
  }

  private applyRole(u: SafeUser, nextRole: Roles) {
    const prevRole = normRole((u as any).scope);
    if (prevRole === nextRole) return;

    this.updating.set({ ...this.updating(), [u.id]: true });
    this.gridApi?.refreshCells({ force: true });

    this.api
      .updateScope(u.id, nextRole)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.list.set(this.list().map((x) => (x.id === u.id ? updated : x)));
          this.toast.success(`Permissão de ${u.nickname}: ${prevRole} → ${normRole((updated as any).scope)}`);

          // atualiza grid
          this.gridApi?.refreshCells({ force: true });
        },
        error: (e) => {
          this.toast.error(e?.error?.message ?? 'Falha ao atualizar permissão');
        },
        complete: () => {
          const cur = { ...this.updating() };
          delete cur[u.id];
          this.updating.set(cur);
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }
}
