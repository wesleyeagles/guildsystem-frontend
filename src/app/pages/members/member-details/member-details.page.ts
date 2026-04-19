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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  UsersApi,
  type PublicUserProfile,
  type UserEventHistoryPaged,
  type UserEventHistoryRow,
  type PointsHistoryPaged,
  type PointsHistoryRow,
  type NicknameChangeLogItem,
} from '../../../api/users.api';
import { LogsApi } from '../../../api/logs.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../../ui/toast/toast.service';
import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';
import { headerT } from '../../../shared/table/table-i18n';
import { AuthService } from '../../../auth/auth.service';
import { Dialog } from '@angular/cdk/dialog';
import { EditNicknameDialogComponent, type EditNicknameResult } from '../../../ui/modal/edit-nickname/edit-nickname.dialog';

import { LucideAngularModule, ArrowLeft, Pencil } from 'lucide-angular';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { discordAvatarUrl } from '../../../utils/discord-avatar';
import { gameClassPublicPath, getGameClassOption, isValidGameClassSlug } from '../../../data/game-classes';

type Roles = 'none' | 'readonly' | 'moderator' | 'admin' | 'root';
type Tab = 'history' | 'points' | 'nicknames';

const TZ_BRASILIA = 'America/Sao_Paulo';

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function asStr(v: any) {
  return String(v ?? '').trim();
}
function isReversed(it: UserEventHistoryRow) {
  return Boolean(it.reversedAt);
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, LucideAngularModule, TranslocoPipe],
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
  private transloco = inject(TranslocoService);
  private dialog = inject(Dialog);

  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  readonly BackIcon = ArrowLeft;
  readonly PencilIcon = Pencil;

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
  removeTitle = new FormControl<string>('', { nonNullable: true });
  removeReason = new FormControl<string>('', { nonNullable: true });

  submittingManual = signal(false);
  submittingPoints = signal(false);

  reversingClaimId = signal<number | null>(null);
  rowErrorClaimId = signal<number | null>(null);
  rowError = signal('');
  private reverseReasonControls = new Map<number, FormControl<string>>();

  nicknameHistory = signal<NicknameChangeLogItem[]>([]);
  nicknameHistoryLoading = signal(false);
  nicknameHistoryError = signal('');

  readonly meRole = computed(() => (this.auth.user()?.scope ?? 'none') as Roles);
  readonly isAdmin = computed(() => {
    const s = this.meRole();
    return s === 'admin' || s === 'root';
  });

  readonly isOwnProfile = computed(() => {
    const id = this.userId();
    const me = this.auth.user();
    return !!id && !!me && me.userId === id;
  });

  readonly title = computed(() => {
    void this.langTick();
    const p = this.profile();
    if (!p) return this.transloco.translate('member.titleMembro');
    return asStr(p.user.nickname) || this.transloco.translate('member.titleMembroId', { id: p.user.id });
  });

  readonly email = computed(() => asStr(this.profile()?.user.email) || '—');
  readonly nickname = computed(() => asStr(this.profile()?.user.nickname) || '—');

  readonly roleLabel = computed(() => {
    void this.langTick();
    const s = asStr(this.profile()?.user.scope);
    if (s === 'readonly') return this.transloco.translate('member.roleReadonly');
    if (s === 'moderator') return this.transloco.translate('member.roleModerator');
    if (s === 'admin') return this.transloco.translate('member.roleAdmin');
    if (s === 'root') return this.transloco.translate('member.roleRoot');
    if (s === 'none') return this.transloco.translate('member.roleNone');
    return this.transloco.translate('member.roleReadonly');
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

  readonly lastLoginAt = computed(() => {
    void this.langTick();
    return this.formatDateTime(this.profile()?.stats?.lastLoginAt ?? null);
  });

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

  readonly gameClassOption = computed(() => getGameClassOption(this.profile()?.user.characterClass));

  readonly gameClassImageSrc = computed(() => {
    const o = this.gameClassOption();
    return o ? gameClassPublicPath(o) : null;
  });

  readonly gameClassLabel = computed(() => {
    void this.langTick();
    const o = this.gameClassOption();
    if (o) {
      return o.label;
    }
    return this.transloco.translate('common.emDash');
  });

  constructor() {
    this.tableConfig = this.buildHistoryTableConfig();
    this.pointsTableConfig = this.buildPointsTableConfig();

    effect(() => {
      this.langTick();
      this.isAdmin();
      this.tableConfig = this.buildHistoryTableConfig();
      this.pointsTableConfig = this.buildPointsTableConfig();
      queueMicrotask(() => {
        this.gridApi?.setGridOption('columnDefs', this.tableConfig.colDefs as any);
        this.pointsGridApi?.setGridOption('columnDefs', this.pointsTableConfig.colDefs as any);
      });
    });

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
    if (t === 'nicknames') this.loadNicknameHistory();
    this.gridApi?.refreshCells({ force: true });
    this.pointsGridApi?.refreshCells({ force: true });
  }

  openNicknameModal() {
    const u = this.profile()?.user;
    const cls = asStr(u?.characterClass);
    const ref = this.dialog.open(EditNicknameDialogComponent, {
      data: {
        currentNickname: asStr(u?.nickname) || '',
        currentCharacterClass: isValidGameClassSlug(cls) ? cls : '',
      },
    });
    ref.closed.subscribe((result: unknown) => {
      const r = result as EditNicknameResult | null | undefined;
      if (r && 'user' in r) {
        this.auth.setSafeUser(r.user);
        this.loadProfile();
        this.loadNicknameHistory();
      }
    });
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
      next: (p) => {
        this.profile.set(p ?? null);
        this.loadNicknameHistory();
      },
      error: (e) => this.error.set(e?.error?.message ?? this.transloco.translate('member.errProfile')),
      complete: () => this.loading.set(false),
    });
  }

  loadNicknameHistory() {
    const id = this.userId();
    if (!id) return;

    this.nicknameHistoryLoading.set(true);
    this.nicknameHistoryError.set('');

    this.api.getNicknameHistory(id).subscribe({
      next: (list) => this.nicknameHistory.set(list ?? []),
      error: (e) => this.nicknameHistoryError.set(e?.error?.message ?? this.transloco.translate('member.errNickHistory')),
      complete: () => this.nicknameHistoryLoading.set(false),
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
      error: (e) => this.historyError.set(e?.error?.message ?? this.transloco.translate('member.errHistory')),
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
      error: (e) => this.pointsError.set(e?.error?.message ?? this.transloco.translate('member.errPointsHistory')),
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

    if (!title) return this.toast.error(this.transloco.translate('toast.titleRequired'));
    if (!Number.isFinite(points) || points === 0) return this.toast.error(this.transloco.translate('toast.pointsInvalid'));

    this.submittingManual.set(true);

    this.api.manualClaim(userId, { title, points, reason }).subscribe({
      next: (r: any) => {
        this.toast.success(
          this.transloco.translate('toast.participationAdded', {
            pts: Number(r?.pointsAdded ?? points),
          }),
        );
        this.manualTitle.setValue('');
        this.manualPoints.setValue(0 as any);
        this.manualReason.setValue('');

        this.pointsPage.set(1);
        this.loadProfile();
        this.loadHistory();
        this.loadPointsHistory();
      },
      error: (e) =>
        this.toast.error(e?.error?.message ?? this.transloco.translate('toast.participationFail')),
      complete: () => this.submittingManual.set(false),
    });
  }

  submitRemovePoints() {
    if (!this.isAdmin()) return;

    const userId = this.userId();
    if (!userId) return;

    const raw = Number(this.removePoints.value ?? 0);
    const n = Math.abs(raw);

    if (!Number.isFinite(n) || n <= 0) return this.toast.error(this.transloco.translate('toast.pointsRemoveQty'));

    const delta = -n;
    const title = asStr(this.removeTitle.value) || this.transloco.translate('member.defaultRemoveLogTitle');
    const reason = asStr(this.removeReason.value) || null;

    this.submittingPoints.set(true);

    this.api.adjustPoints(userId, { delta, title, reason }).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('toast.pointsRemoved', { n }));
        this.removePoints.setValue(0 as any);
        this.removeReason.setValue('');
        this.loadProfile();
        this.loadPointsHistory();
      },
      error: (e) =>
        this.toast.error(e?.error?.message ?? this.transloco.translate('toast.pointsRemoveFail')),
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
        this.toast.success(
          r?.alreadyReversed
            ? this.transloco.translate('toast.claimAlreadyCancelled')
            : this.transloco.translate('toast.claimCancelled', { pts }),
        );

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
        this.rowError.set(e?.error?.message ?? this.transloco.translate('member.errReverseClaim'));
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
        colId: 'status',
        ...headerT(this.transloco, 'member.col.status'),
        width: 120,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return '';
          return isReversed(it) ? 'reverted' : 'active';
        },
        cellRenderer: (p: any) => {
          const k = String(p.value ?? '');
          const label =
            k === 'active'
              ? this.transloco.translate('member.historyActive')
              : this.transloco.translate('member.historyReverted');
          const cls = k === 'active' ? 'pill pill--active' : 'pill pill--canceled';
          return `<span class="${cls}">${this.escapeHtml(label)}</span>`;
        },
      },
      {
        colId: 'event',
        ...headerT(this.transloco, 'member.col.event'),
        minWidth: 220,
        flex: 1,
        sortable: true,
        valueGetter: (p) => (p.data?.title ?? ''),
        cellRenderer: (p: any) => {
          const it = p.data as UserEventHistoryRow | undefined;
          if (!it) return '';

          const rawTitle =
            it.title ??
            this.transloco.translate('member.eventFallback', { id: String(it.eventId ?? '') });
          const title = this.escapeHtml(rawTitle);
          const base = asInt(it.pointsBase, 0);
          const bonus = it.hasPilot ? asInt(it.bonusPilot, 0) : 0;
          const granted = asInt(it.pointsGranted, 0);
          const chipBase = this.transloco.translate('member.chipBase');
          const chipPilot = this.transloco.translate('member.chipPilot');
          const chipGranted = this.transloco.translate('member.chipGranted');

          return `
            <div class="ev">
              <div class="ev__title">${title}</div>
              <div class="ev__meta">
                <span class="chip">${chipBase}: +${base}</span>
                <span class="chip chip--bonus">${chipPilot}: +${bonus}</span>
                <span class="chip chip--total">${chipGranted}: +${granted}</span>
              </div>
            </div>
          `;
        },
      },
      {
        colId: 'createdAt',
        ...headerT(this.transloco, 'member.col.date'),
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt).getTime() : 0),
        valueFormatter: (p) => (p.data?.createdAt ? this.formatDateTime(p.data.createdAt) : '—'),
        cellClass: 'mono',
      },
      {
        colId: 'actions',
        ...headerT(this.transloco, 'member.col.actions'),
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
          input.placeholder = this.transloco.translate('member.reverseReasonPh');
          input.value = ctrl.value ?? '';

          const btn = document.createElement('button');
          btn.className = 'btn btn-reverse';
          btn.textContent = this.transloco.translate('member.reverseClaimBtn');
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
      quickFilterPlaceholderKey: 'logs.filterPage',
      pagination: { enabled: true, autoPageSize: true },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<UserEventHistoryRow>) => (this.gridApi = e.api),
      },
    };
  }

  private buildPointsTableConfig(): DataTableConfig<PointsHistoryRow> {
    const colDefs: ColDef<PointsHistoryRow>[] = [
      {
        colId: 'createdAt',
        ...headerT(this.transloco, 'member.col.when'),
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.createdAt ? new Date(p.data.createdAt).getTime() : 0),
        valueFormatter: (p) => (p.data?.createdAt ? this.formatDateTime(p.data.createdAt) : '—'),
        cellClass: 'mono',
      },
      {
        colId: 'delta',
        ...headerT(this.transloco, 'member.col.delta'),
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
        colId: 'beforeAfter',
        ...headerT(this.transloco, 'member.col.beforeAfter'),
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
        colId: 'actor',
        ...headerT(this.transloco, 'member.col.who'),
        width: 160,
        sortable: true,
        valueGetter: (p) => {
          const it = p.data as PointsHistoryRow | undefined;
          if (!it) return '';
          return it.actor?.nickname ?? (it.actor?.userId != null ? `#${it.actor.userId}` : '__system__');
        },
        cellRenderer: (p: any) => {
          const raw = String(p.value ?? '');
          const display = raw === '__system__' ? this.transloco.translate('member.system') : raw;
          return `<span class="mono">${this.escapeHtml(display)}</span>`;
        },
      },
      {
        colId: 'meta',
        ...headerT(this.transloco, 'member.col.titleReason'),
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
      quickFilterPlaceholderKey: 'logs.filterPage',
      pagination: { enabled: true, autoPageSize: true },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<PointsHistoryRow>) => (this.pointsGridApi = e.api),
      },
    };
  }

  formatDateTime(iso: string | null | undefined) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    void this.langTick();
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