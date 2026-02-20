import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import {
  UsersApi,
  type PublicUserProfile,
  type UserEventHistoryPaged,
  type UserEventHistoryRow,
  type PointsHistoryPaged,
  type PointsHistoryRow,
} from '../../../api/users.api';
import { LogsApi } from '../../../api/logs.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../../ui/toast/toast.service';
import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';
import { AuthService } from '../../../auth/auth.service';

import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { discordAvatarUrl } from '../../../utils/discord-avatar';

type Roles = 'none' | 'readonly' | 'moderator' | 'admin' | 'root';
type Tab = 'history' | 'points';

const TZ_BRASILIA = 'America/Sao_Paulo';

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function asStr(v: any) {
  return String(v ?? '').trim();
}
function fmtDateTimeBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';

  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);

  return `${date} ${time}`;
}
function isReversed(it: UserEventHistoryRow) {
  return Boolean(it.reversedAt);
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, LucideAngularModule],
  templateUrl: './member-details.page.html',
  styleUrl: './member-details.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDetailsPage {
  private api = inject(UsersApi);
  private logsApi = inject(LogsApi);
  private auth = inject(AuthService);

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private toast = inject(ToastService);

  readonly BackIcon = ArrowLeft;

  userId = signal<number>(0);

  loading = signal(false);
  error = signal('');

  profile = signal<PublicUserProfile | null>(null);

  tab = signal<Tab>('history');

  // search (usa o mesmo pra ambas abas)
  q = signal('');
  private q$ = new Subject<string>();

  // histórico (event claims)
  historyLoading = signal(false);
  historyError = signal('');
  page = signal(1);
  pageSize = signal(15);
  history = signal<UserEventHistoryPaged | null>(null);
  private gridApi?: GridApi<UserEventHistoryRow>;
  tableConfig!: DataTableConfig<UserEventHistoryRow>;

  // pontos (points logs)
  pointsLoading = signal(false);
  pointsError = signal('');
  pointsPage = signal(1);
  pointsPageSize = signal(15);
  points = signal<PointsHistoryPaged | null>(null);
  private pointsGridApi?: GridApi<PointsHistoryRow>;
  pointsTableConfig!: DataTableConfig<PointsHistoryRow>;

  // admin actions
  manualTitle = new FormControl<string>('', { nonNullable: true });
  manualPoints = new FormControl<number>(0 as any, { nonNullable: true });
  manualReason = new FormControl<string>('', { nonNullable: true });

  removePoints = new FormControl<number>(0 as any, { nonNullable: true });
  removeTitle = new FormControl<string>('Pontos do Leilão', { nonNullable: true });
  removeReason = new FormControl<string>('', { nonNullable: true });

  submittingManual = signal(false);
  submittingPoints = signal(false);

  reversingClaimId = signal<number | null>(null);
  rowErrorClaimId = signal<number | null>(null);
  rowError = signal('');
  private reverseReasonControls = new Map<number, FormControl<string>>();

  readonly meRole = computed(() => (this.auth.user()?.scope ?? 'none') as Roles);
  readonly isAdmin = computed(() => {
    const s = this.meRole();
    return s === 'admin' || s === 'root';
  });

  readonly title = computed(() => {
    const p = this.profile();
    if (!p) return 'Membro';
    return asStr(p.user.nickname) || `Membro #${p.user.id}`;
  });

  readonly email = computed(() => asStr(this.profile()?.user.email) || '—');
  readonly nickname = computed(() => asStr(this.profile()?.user.nickname) || '—');

  readonly roleLabel = computed(() => {
    const s = asStr(this.profile()?.user.scope);
    if (s === 'readonly') return 'Membro';
    if (s === 'moderator') return 'Moderador';
    if (s === 'admin') return 'Admin';
    if (s === 'root') return 'Root';
    if (s === 'none') return 'Nenhum';
    return 'Membro';
  });

  readonly userPoints = computed(() => {
    const v = (this.profile()?.user as any)?.points;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly totalRegistered = computed(() => {
    const v = (this.profile()?.stats as any)?.totalRegistered;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly totalSpent = computed(() => {
    const v = (this.profile()?.stats as any)?.totalSpent;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly warnings = computed(() => {
    const v = (this.profile()?.stats as any)?.warnings;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly lastLoginAt = computed(() => fmtDateTimeBR(this.profile()?.stats?.lastLoginAt ?? null));

  readonly avatarUrl = computed(() => {
    const u: any = this.profile()?.user as any;
    return discordAvatarUrl(
      {
        discordId: u?.discordId ?? null,
        discordAvatar: u?.discordAvatar ?? null,
        discordDiscriminator: u?.discordDiscriminator ?? null,
      },
      96,
    );
  });

  constructor() {
    this.tableConfig = this.buildHistoryTableConfig();
    this.pointsTableConfig = this.buildPointsTableConfig();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => {
      const id = asInt(m.get('id'), 0);
      if (!id || id <= 0) {
        this.router.navigateByUrl('/');
        return;
      }

      this.userId.set(id);

      this.page.set(1);
      this.pointsPage.set(1);

      this.loadProfile();
      this.loadHistory();
      this.loadPointsHistory();
    });

    this.q$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((v) => {
          this.q.set(v);
          this.page.set(1);
          this.pointsPage.set(1);
        }),
        switchMap(() =>
          of(null).pipe(
            tap(() => {
              this.loadHistory();
              this.loadPointsHistory();
            }),
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    effect(() => {
      this.isAdmin();
      this.reversingClaimId();
      this.rowErrorClaimId();
      this.rowError();
      this.gridApi?.refreshCells({ force: true });
      this.pointsGridApi?.refreshCells({ force: true });
    });
  }

  back() {
    history.back();
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.gridApi?.refreshCells({ force: true });
    this.pointsGridApi?.refreshCells({ force: true });
  }

  onSearchChange(v: string) {
    this.q$.next(String(v ?? ''));
  }

  loadProfile() {
    const id = this.userId();
    if (!id) return;

    this.loading.set(true);
    this.error.set('');

    this.api.publicProfile(id).subscribe({
      next: (p) => this.profile.set(p ?? null),
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar perfil'),
      complete: () => this.loading.set(false),
    });
  }

  loadHistory() {
    const id = this.userId();
    if (!id) return;

    this.historyLoading.set(true);
    this.historyError.set('');

    this.api.publicEventHistory(id, { page: this.page(), pageSize: this.pageSize(), q: asStr(this.q()) || undefined }).subscribe({
      next: (res) => {
        this.history.set(res ?? null);
        this.gridApi?.refreshCells({ force: true });
      },
      error: (e) => this.historyError.set(e?.error?.message ?? 'Falha ao carregar histórico'),
      complete: () => this.historyLoading.set(false),
    });
  }

  loadPointsHistory() {
    const id = this.userId();
    if (!id) return;

    this.pointsLoading.set(true);
    this.pointsError.set('');

    this.api.pointsHistory(id, { page: this.pointsPage(), pageSize: this.pointsPageSize(), q: asStr(this.q()) || undefined }).subscribe({
      next: (res) => {
        this.points.set(res ?? null);
        this.pointsGridApi?.refreshCells({ force: true });
      },
      error: (e) => this.pointsError.set(e?.error?.message ?? 'Falha ao carregar logs de pontos'),
      complete: () => this.pointsLoading.set(false),
    });
  }

  prevPointsPage() {
    const p = this.pointsPage();
    if (p <= 1) return;
    this.pointsPage.set(p - 1);
    this.loadPointsHistory();
  }

  nextPointsPage() {
    const tp = this.points()?.totalPages ?? 1;
    const p = this.pointsPage();
    if (p >= tp) return;
    this.pointsPage.set(p + 1);
    this.loadPointsHistory();
  }

  submitManualClaim() {
    if (!this.isAdmin()) return;

    const userId = this.userId();
    if (!userId) return;

    const title = asStr(this.manualTitle.value);
    const points = Number(this.manualPoints.value ?? 0);
    const reason = asStr(this.manualReason.value) || null;

    if (!title) return this.toast.error('Título é obrigatório');
    if (!Number.isFinite(points) || points === 0) return this.toast.error('Pontos inválidos');

    this.submittingManual.set(true);

    this.api.manualClaim(userId, { title, points, reason }).subscribe({
      next: (r: any) => {
        this.toast.success(`Participação adicionada (+${Number(r?.pointsAdded ?? points)} pontos).`);
        this.manualTitle.setValue('');
        this.manualPoints.setValue(0 as any);
        this.manualReason.setValue('');

        this.pointsPage.set(1);
        this.loadProfile();
        this.loadHistory();
        this.loadPointsHistory();
      },
      error: (e) => this.toast.error(e?.error?.message ?? 'Falha ao adicionar participação'),
      complete: () => this.submittingManual.set(false),
    });
  }

  submitRemovePoints() {
    if (!this.isAdmin()) return;

    const userId = this.userId();
    if (!userId) return;

    const raw = Number(this.removePoints.value ?? 0);
    const n = Math.abs(raw);

    if (!Number.isFinite(n) || n <= 0) return this.toast.error('Informe quantos pontos remover');

    const delta = -n;
    const title = asStr(this.removeTitle.value) || 'Remoção manual';
    const reason = asStr(this.removeReason.value) || null;

    this.submittingPoints.set(true);

    this.api.adjustPoints(userId, { delta, title, reason }).subscribe({
      next: () => {
        this.toast.success(`${n} pontos removidos.`);
        this.removePoints.setValue(0 as any);
        this.removeReason.setValue('');
        this.loadProfile();
        this.loadPointsHistory();
      },
      error: (e) => this.toast.error(e?.error?.message ?? 'Falha ao remover pontos'),
      complete: () => this.submittingPoints.set(false),
    });
  }

  private reverseReasonCtrl(claimId: number) {
    let c = this.reverseReasonControls.get(claimId);
    if (!c) {
      c = new FormControl('', { nonNullable: true });
      this.reverseReasonControls.set(claimId, c);
    }
    return c;
  }

  reverseClaim(row: UserEventHistoryRow) {
    if (!this.isAdmin()) return;
    if (!row?.claimId) return;
    if (isReversed(row)) return;

    const claimId = Number(row.claimId);
    const ctrl = this.reverseReasonCtrl(claimId);
    const reason = asStr(ctrl.value) || null;

    this.reversingClaimId.set(claimId);
    this.rowErrorClaimId.set(null);
    this.rowError.set('');
    this.gridApi?.refreshCells({ force: true });

    this.logsApi.reverseClaim(claimId, reason ? { reason } : {}).subscribe({
      next: (r: any) => {
        const pts = Number(r?.pointsReverted ?? 0);
        this.toast.success(r?.alreadyReversed ? 'Esse claim já estava cancelado.' : `Claim cancelado (-${pts} pts).`);

        ctrl.reset('');

        const cur = this.history();
        if (cur) {
          const items = (cur.items ?? []).map((x) =>
            x.claimId === claimId
              ? { ...x, reversedAt: r?.reversedAt ?? new Date().toISOString(), reverseReason: reason }
              : x,
          );
          this.history.set({ ...cur, items });
        }

        this.loadProfile();
        this.loadPointsHistory();
        this.gridApi?.refreshCells({ force: true });
      },
      error: (e) => {
        this.rowErrorClaimId.set(claimId);
        this.rowError.set(e?.error?.message ?? 'Falha ao cancelar claim');
        this.gridApi?.refreshCells({ force: true });
      },
      complete: () => {
        this.reversingClaimId.set(null);
        this.gridApi?.refreshCells({ force: true });
      },
    });
  }

  private buildHistoryTableConfig(): DataTableConfig<UserEventHistoryRow> {
    const colDefs: ColDef<UserEventHistoryRow>[] = [
      {
        headerName: 'Status',
        colId: 'status',
        width: 120,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return '';
          return isReversed(it) ? 'Revertido' : 'Ativo';
        },
        cellRenderer: (p: any) => {
          const v = String(p.value ?? '');
          const cls = v === 'Ativo' ? 'pill pill--active' : 'pill pill--canceled';
          return `<span class="${cls}">${this.escapeHtml(v)}</span>`;
        },
      },
      {
        headerName: 'Evento',
        colId: 'event',
        minWidth: 220,
        flex: 1,
        sortable: true,
        valueGetter: (p) => (p.data?.title ?? ''),
        cellRenderer: (p: any) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return '';

          const title = this.escapeHtml(it.title ?? `Evento #${it.eventId ?? ''}`);
          const base = asInt(it.pointsBase, 0);
          const bonus = it.hasPilot ? asInt(it.bonusPilot, 0) : 0;
          const granted = asInt(it.pointsGranted, 0);

          return `
            <div class="ev">
              <div class="ev__title">${title}</div>
              <div class="ev__meta">
                <span class="chip">Base: +${base}</span>
                <span class="chip chip--bonus">Piloto: +${bonus}</span>
                <span class="chip chip--total">Concedido: +${granted}</span>
              </div>
            </div>
          `;
        },
      },
      {
        headerName: 'Data',
        colId: 'createdAt',
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt).getTime() : 0),
        valueFormatter: (p) => (p.data?.createdAt ? fmtDateTimeBR(p.data.createdAt) : '—'),
        cellClass: 'mono',
      },
      {
        headerName: 'Ações',
        colId: 'actions',
        minWidth: 520,
        flex: 1,
        sortable: false,
        filter: false,
        hide: !this.isAdmin(),
        cellRenderer: (params: any) => {
          const it = params.data as UserEventHistoryRow | undefined;
          if (!it) return '';

          const wrap = document.createElement('div');
          wrap.className = 'actions';

          if (!this.isAdmin() || isReversed(it)) {
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = '—';
            wrap.appendChild(span);
            return wrap;
          }

          const claimId = Number(it.claimId ?? 0);
          const ctrl = this.reverseReasonCtrl(claimId);

          const input = document.createElement('input');
          input.className = 'reason';
          input.placeholder = 'Motivo (opcional)';
          input.value = ctrl.value ?? '';

          const btn = document.createElement('button');
          btn.className = 'btn-reverse';
          btn.textContent = 'Cancelar';
          btn.type = 'button';

          input.addEventListener('input', (e: any) => {
            ctrl.setValue(String(e?.target?.value ?? ''));
            ctrl.markAsDirty();
            ctrl.markAsTouched();
          });

          btn.addEventListener('click', () => this.reverseClaim(it));

          wrap.appendChild(input);
          wrap.appendChild(btn);
          return wrap;
        },
      },
    ];

    return {
      id: 'member-history',
      colDefs,
      rowHeight: 76,
      quickFilterPlaceholder: 'Filtrar nesta página...',
      pagination: { enabled: true, autoPageSize: true },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<UserEventHistoryRow>) => (this.gridApi = e.api),
      },
    };
  }

  private buildPointsTableConfig(): DataTableConfig<PointsHistoryRow> {
    const colDefs: ColDef<PointsHistoryRow>[] = [
      {
        headerName: 'Quando',
        colId: 'createdAt',
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt).getTime() : 0),
        valueFormatter: (p) => (p.data?.createdAt ? fmtDateTimeBR(p.data.createdAt) : '—'),
        cellClass: 'mono',
      },
      {
        headerName: 'Delta',
        colId: 'delta',
        width: 110,
        sortable: true,
        valueGetter: (p) => asInt(p.data?.delta, 0),
        cellRenderer: (p: any) => {
          const n = asInt(p.value, 0);
          const cls = n >= 0 ? 'points points--ok' : 'points points--bad';
          return `<span class="${cls}">${n >= 0 ? '+' : ''}${n}</span>`;
        },
      },
      {
        headerName: 'Antes → Depois',
        colId: 'beforeAfter',
        width: 170,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as PointsHistoryRow | undefined;
          if (!it) return '';
          return `${asInt(it.beforePoints, 0)}→${asInt(it.afterPoints, 0)}`;
        },
        cellRenderer: (p: any) => `<span class="mono">${this.escapeHtml(String(p.value ?? '—'))}</span>`,
      },
      {
        headerName: 'Quem',
        colId: 'actor',
        width: 160,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as PointsHistoryRow | undefined;
          if (!it) return '';
          return it.actor?.nickname ?? (it.actor?.userId != null ? `#${it.actor.userId}` : 'Sistema');
        },
        cellRenderer: (p: any) => `<span class="mono">${this.escapeHtml(String(p.value ?? '—'))}</span>`,
      },
      {
        headerName: 'Título / Motivo',
        colId: 'meta',
        minWidth: 260,
        flex: 1,
        sortable: false,
        cellRenderer: (p: any) => {
          const it = p.data as PointsHistoryRow | undefined;
          if (!it) return '';
          const title = this.escapeHtml(it.title ?? '—');
          const reason = this.escapeHtml(it.reason ?? '');
          return `
            <div class="ev">
              <div class="ev__title">${title}</div>
              ${reason ? `<div class="ev__reason">${reason}</div>` : `<div class="ev__reason muted">—</div>`}
            </div>
          `;
        },
      },
    ];

    return {
      id: 'member-points',
      colDefs,
      rowHeight: 72,
      quickFilterPlaceholder: 'Filtrar nesta página...',
      pagination: { enabled: true, autoPageSize: true },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<PointsHistoryRow>) => (this.pointsGridApi = e.api),
      },
    };
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