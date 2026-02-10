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

import { UsersApi, type PublicUserProfile, type UserEventHistoryPaged, type UserEventHistoryRow } from '../../../api/users.api';
import { LogsApi } from '../../../api/logs.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { UiPagerComponent } from '../../../ui/pagination/ui-pager.component';
import { ToastService } from '../../../ui/toast/toast.service';
import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';
import { AuthService } from '../../../auth/auth.service';

import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { discordAvatarUrl } from '../../../utils/discord-avatar';

type Roles = 'none' | 'readonly' | 'moderator' | 'admin' | 'root';
const TZ_BRASILIA = 'America/Sao_Paulo';

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function asStr(v: any) {
  return String(v ?? '').trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UiSpinnerComponent,
    UiPagerComponent,
    DataTableComponent,
    LucideAngularModule,
  ],
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

  historyLoading = signal(false);
  historyError = signal('');

  q = signal('');
  private q$ = new Subject<string>();

  page = signal(1);
  pageSize = signal(15);
  readonly pageSizes = [10, 15, 25, 50] as const;

  history = signal<UserEventHistoryPaged | null>(null);

  private gridApi?: GridApi<UserEventHistoryRow>;
  tableConfig!: DataTableConfig<UserEventHistoryRow>;

  // admin ui
  manualTitle = new FormControl<string>('', { nonNullable: true });
  manualPoints = new FormControl<number>(0 as any, { nonNullable: true });
  manualReason = new FormControl<string>('', { nonNullable: true });

  removePoints = new FormControl<number>(0 as any, { nonNullable: true });

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

  readonly points = computed(() => {
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
    this.tableConfig = this.buildTableConfig();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => {
      const id = asInt(m.get('id'), 0);
      if (!id || id <= 0) {
        this.router.navigateByUrl('/');
        return;
      }
      this.userId.set(id);
      this.page.set(1);
      this.loadProfile();
      this.loadHistory();
    });

    this.q$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((v) => {
          this.q.set(v);
          this.page.set(1);
        }),
        switchMap(() => {
          return of(null).pipe(
            tap(() => this.loadHistory()),
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    effect(() => {
      this.isAdmin();
      this.reversingClaimId();
      this.rowErrorClaimId();
      this.rowError();
      this.gridApi?.refreshCells({ force: true });
    });
  }

  back() {
    history.back();
  }

  onSearchChange(v: string) {
    this.q$.next(String(v ?? ''));
  }

  onChangePageSize(n: number) {
    this.pageSize.set(n);
    this.page.set(1);
    this.loadHistory();
  }

  prevPage() {
    const p = this.page();
    if (p <= 1) return;
    this.page.set(p - 1);
    this.loadHistory();
  }

  nextPage() {
    const tp = this.history()?.totalPages ?? 1;
    const p = this.page();
    if (p >= tp) return;
    this.page.set(p + 1);
    this.loadHistory();
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

    this.api
      .publicEventHistory(id, { page: this.page(), pageSize: this.pageSize(), q: asStr(this.q()) || undefined })
      .subscribe({
        next: (res) => {
          this.history.set(res ?? null);
          this.gridApi?.refreshCells({ force: true });
        },
        error: (e) => this.historyError.set(e?.error?.message ?? 'Falha ao carregar histórico'),
        complete: () => this.historyLoading.set(false),
      });
  }

  // =========================
  // ✅ Admin actions
  // =========================

  submitManualClaim() {
    if (!this.isAdmin()) return;

    const userId = this.userId();
    if (!userId) return;

    const title = asStr(this.manualTitle.value);
    const points = Number(this.manualPoints.value ?? 0);
    const reason = asStr(this.manualReason.value) || null;

    if (!title) {
      this.toast.error('Título é obrigatório');
      return;
    }
    if (!Number.isFinite(points) || points === 0) {
      this.toast.error('Pontos inválidos');
      return;
    }

    this.submittingManual.set(true);

    this.api.manualClaim(userId, { title, points, reason }).subscribe({
      next: (r: any) => {
        this.toast.success(`Participação adicionada (+${Number(r?.pointsAdded ?? points)} pontos).`);
        this.manualTitle.setValue('');
        this.manualPoints.setValue(0 as any);
        this.manualReason.setValue('');
        this.page.set(1);
        this.loadProfile();
        this.loadHistory();
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

    if (!Number.isFinite(n) || n <= 0) {
      this.toast.error('Informe quantos pontos remover');
      return;
    }

    const delta = -n;

    this.submittingPoints.set(true);

    this.api.adjustPoints(userId, delta).subscribe({
      next: () => {
        this.toast.success(`${n} pontos removidos.`);
        this.removePoints.setValue(0 as any);
        this.loadProfile();
      },
      error: (e) => this.toast.error(e?.error?.message ?? 'Falha ao remover pontos'),
      complete: () => this.submittingPoints.set(false),
    });
  }

  reverseReasonCtrl(claimId: number) {
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

        // atualiza local (pra UX imediata)
        const cur = this.history();
        if (cur) {
          const items = (cur.items ?? []).map((x) =>
            x.claimId === claimId
              ? {
                  ...x,
                  reversedAt: (r?.reversedAt ? new Date(r.reversedAt).toISOString() : new Date().toISOString()),
                  reverseReason: reason,
                }
              : x,
          );
          this.history.set({ ...cur, items });
        }

        this.loadProfile(); // pontos mudaram
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

  // =========================
  // ✅ DataTable config
  // =========================

  private buildTableConfig(): DataTableConfig<UserEventHistoryRow> {
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
        width: 150,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return '';
          return it.title ?? `Evento #${it.eventId ?? ''}`;
        },
        cellRenderer: (p: any) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return '';

          const title = this.escapeHtml(it.title ?? `Evento #${it.eventId ?? ''}`);

          return `
            <div class="ev">
              <div class="ev__title">${title}</div>
            </div>
          `;
        },
      },
      {
        headerName: 'Pontos',
        colId: 'points',
        width: 110,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return 0;
          return Number(it.points ?? 0);
        },
        cellRenderer: (p: any) => {
          const n = Number(p.value ?? 0);
          return `<span class="points">${n >= 0 ? '+' : ''}${n}</span>`;
        },
      },
      {
        headerName: 'Data',
        colId: 'createdAt',
        width: 190,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it?.createdAt) return 0;
          return new Date(it.createdAt).getTime();
        },
        valueFormatter: (p) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it?.createdAt) return '—';
          return fmtDateTimeBR(it.createdAt);
        },
        cellClass: 'mono',
      },
      {
        headerName: 'Ações',
        colId: 'actions',
        minWidth: 520,
        flex: 1,
        sortable: false,
        filter: false,
        hide: !this.isAdmin(), // ✅ coluna só existe visualmente pra admin
        cellRenderer: (params: any) => {
          const it = params.data as UserEventHistoryRow | undefined;
          if (!it) return '';

          const wrap = document.createElement('div');
          wrap.className = 'actions';

          // se não admin, nem renderiza (redundância)
          if (!this.isAdmin()) {
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = '—';
            wrap.appendChild(span);
            return wrap;
          }

          if (isReversed(it)) {
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
          btn.type = 'button';

          const err = document.createElement('span');
          err.className = 'row-err';

          const render = () => {
            const isSubmitting = this.reversingClaimId() === claimId;

            input.disabled = isSubmitting;
            btn.disabled = isSubmitting;

            btn.textContent = isSubmitting ? '...' : 'Cancelar reinvindicação';

            const showErr = this.rowErrorClaimId() === claimId && !!this.rowError();
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
            this.reverseClaim(it);
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
      id: 'member-history',
      colDefs,
      rowHeight: 72,
      quickFilterPlaceholder: 'Filtrar nesta página...',
      ui: {
        showPager: true,
        showSearch: true,
        showChips: false,
      },
      pagination: {
        enabled: true,
        autoPageSize: true,
      },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<UserEventHistoryRow>) => {
          this.gridApi = e.api;
        },
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
