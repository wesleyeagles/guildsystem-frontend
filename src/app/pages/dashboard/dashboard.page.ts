import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { AuthService } from '../../auth/auth.service';
import { UsersApi, type LeaderboardRow } from '../../api/users.api';
import { EventsApi, type EventInstance } from '../../api/events.api';

import { EventToastManager } from '../../events/event-toast.manager';
import { discordAvatarUrl } from '../../utils/discord-avatar';

import { DataTableComponent } from '../../shared/table/data-table.component';
import type { DataTableConfig } from '../../shared/table/table.types';
import { headerT } from '../../shared/table/table-i18n';

const TZ_BRASILIA = 'America/Sao_Paulo';

function safeStr(v: any) {
  return String(v ?? '').trim();
}

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

function fmtDateTimeLocale(isoOrDate: any, locale: string) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';

  const loc = locale === 'pt-BR' ? 'pt-BR' : locale === 'ru' ? 'ru-RU' : 'en-US';
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

function evPoints(ev: any) {
  const p =
    (typeof ev?.points === 'number' ? ev.points : null) ??
    (typeof ev?.pointsApplied === 'number' ? ev.pointsApplied : null) ??
    (typeof ev?.basePoints === 'number' ? ev.basePoints : null) ??
    0;
  return Number(p) || 0;
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent, TranslocoPipe],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private auth = inject(AuthService);
  private usersApi = inject(UsersApi);
  private eventsApi = inject(EventsApi);
  private router = inject(Router);
  private manager = inject(EventToastManager);
  private transloco = inject(TranslocoService);
  private langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  leaders = signal<LeaderboardRow[]>([]);
  leadersLoading = signal(false);
  leadersError = signal('');

  allEvents = signal<EventInstance[]>([]);
  eventsLoading = signal(false);
  eventsError = signal('');

  // grids
  private leadersGrid?: GridApi<LeaderboardRow>;
  private eventsGrid?: GridApi<EventInstance>;

  leadersTableConfig!: DataTableConfig<LeaderboardRow>;
  eventsTableConfig!: DataTableConfig<EventInstance>;

  isAdmin = computed(() => {
    const s = this.auth.userSig()?.scope;
    return s === 'admin' || s === 'root';
  });

  recentEvents = computed(() => {
    const arr = this.allEvents();
    return [...arr].sort((a: any, b: any) => {
      const ta = new Date((a as any).createdAt ?? (a as any).expiresAt ?? 0).getTime();
      const tb = new Date((b as any).createdAt ?? (b as any).expiresAt ?? 0).getTime();
      return tb - ta;
    });
  });

  constructor() {
    this.leadersTableConfig = this.buildLeadersTable();
    this.eventsTableConfig = this.buildEventsTable();

    this.loadLeaders();
    this.loadEvents();

    effect(() => {
      this.langTick();
      this.leadersTableConfig = this.buildLeadersTable();
      this.eventsTableConfig = this.buildEventsTable();
      queueMicrotask(() => {
        this.leadersGrid?.setGridOption('columnDefs', this.leadersTableConfig.colDefs);
        this.eventsGrid?.setGridOption('columnDefs', this.eventsTableConfig.colDefs);
      });
    });

    // refresh quando claim/cancel acontecer via toast
    effect(() => {
      this.manager.version();
      this.eventsGrid?.refreshCells({ force: true });
    });
  }

  // ====== helpers
  openMember(userId: number) {
    const n = Number(userId);
    if (!Number.isFinite(n) || n <= 0) return;
    this.router.navigate(['/members', n]);
  }

  leaderAvatar(r: LeaderboardRow) {
    return discordAvatarUrl(
      {
        discordId: r.discordId,
        discordAvatar: r.discordAvatar,
        discordDiscriminator: r.discordDiscriminator,
      },
      40,
    );
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

  endDate(ev: EventInstance) {
    return fmtDateTimeLocale(ev.expiresAt, this.transloco.getActiveLang());
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

  // ====== API loads
  loadLeaders() {
    this.leadersLoading.set(true);
    this.leadersError.set('');

    this.usersApi.leaderboard(200).subscribe({
      next: (rows) => this.leaders.set(rows ?? []),
      error: (e) =>
        this.leadersError.set(e?.error?.message ?? this.transloco.translate('dashboard.errMembers')),
      complete: () => this.leadersLoading.set(false),
    });
  }

  loadEvents() {
    this.eventsLoading.set(true);
    this.eventsError.set('');

    this.eventsApi.listAll().subscribe({
      next: (list) => {
        this.allEvents.set(list ?? []);
        this.eventsGrid?.refreshCells({ force: true });
      },
      error: (e) =>
        this.eventsError.set(e?.error?.message ?? this.transloco.translate('dashboard.errEvents')),
      complete: () => this.eventsLoading.set(false),
    });
  }

  // ====== tables
  private buildLeadersTable(): DataTableConfig<LeaderboardRow> {
    const colDefs: ColDef<LeaderboardRow>[] = [
      {
        headerName: '#',
        width: 50,
        sortable: true,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        cellClass: 'mono muted',
      },
      {
        colId: 'member',
        ...headerT(this.transloco, 'dashboard.col.member'),
        minWidth: 200,
        sortable: true,
        valueGetter: (p) => safeStr(p.data?.nickname),
        cellRenderer: (p: any) => {
          const r = p.data as LeaderboardRow | undefined;
          if (!r) return '';
          const nick = this.escapeHtml(safeStr(r.nickname));
          const avatar = this.leaderAvatar(r);
          const avatarHtml = avatar
            ? `<img class="ava" src="${this.escapeAttr(avatar)}" referrerpolicy="no-referrer" loading="lazy" alt=""/>`
            : `<div class="ava-fallback">${(nick.slice(0, 1) || '?').toUpperCase()}</div>`;

          return `
            <div class="member">
              ${avatarHtml}
              <div class="member__text">
                <div class="member__name" title="${nick}">${nick}</div>
              </div>
            </div>
          `;
        },
      },
      {
        field: 'points' as any,
        ...headerT(this.transloco, 'dashboard.col.points'),
        width: 120,
        sortable: true,
        cellRenderer: (p: any) => `<span class="points">${Number(p.value ?? 0)}</span>`,
      },
      {
        colId: 'lastEvent',
        ...headerT(this.transloco, 'dashboard.col.lastEvent'),
        flex: 1,
        sortable: false,
        valueGetter: (p) => safeStr((p.data as any)?.lastEventTitle ?? (p.data as any)?.lastEventDefinitionCode ?? ''),
        cellRenderer: (p: any) => {
          const dash = this.transloco.translate('common.emDash');
          const v = this.escapeHtml(String(p.value ?? dash)) || dash;
          return `<span class="muted">${v}</span>`;
        },
      },
      {
        colId: 'actions',
        ...headerT(this.transloco, 'common.actions'),
        width: 90,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellStyle: { justifyContent: 'center' },
        cellRenderer: (params: any) => {
          const r = params.data as LeaderboardRow | undefined;
          if (!r) return '';

          const btn = document.createElement('button');
          btn.className = 'btn-eye';
          btn.type = 'button';
          btn.title = this.transloco.translate('common.view');

          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor"
                d="M12 5c5.5 0 9.5 5.3 9.5 7s-4 7-9.5 7S2.5 13.7 2.5 12 6.5 5 12 5Zm0 2C7.9 7 4.7 11 4.7 12S7.9 17 12 17s7.3-4 7.3-5-3.2-5-7.3-5Zm0 2.2A2.8 2.8 0 1 1 9.2 12 2.8 2.8 0 0 1 12 9.2Zm0 1.6A1.2 1.2 0 1 0 13.2 12 1.2 1.2 0 0 0 12 10.8Z"/>
            </svg>
          `;

          btn.addEventListener('click', () => this.openMember(Number((r as any).userId ?? (r as any).id)));
          return btn;
        },
      },
    ];

    return {
      id: 'home-leaders',
      colDefs,
      rowHeight: 60,
      quickFilterPlaceholderKey: 'common.search',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<LeaderboardRow>) => (this.leadersGrid = e.api),
      },
    };
  }

  private buildEventsTable(): DataTableConfig<EventInstance> {
    const colDefs: ColDef<EventInstance>[] = [
      {
        colId: 'eventTitle',
        ...headerT(this.transloco, 'dashboard.col.event'),
        width: 150,
        sortable: true,
        valueGetter: (p) => safeStr(p.data?.title),
        cellRenderer: (p: any) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return '';

          const title = this.escapeHtml((ev as any).title ?? '');

          return `
            <div class="ev">
              <div class="ev__title" title="${title}">${title}</div>
            </div>
          `;
        },
      },
      {
        colId: 'evPoints',
        ...headerT(this.transloco, 'dashboard.col.points'),
        width: 80,
        sortable: true,
        valueGetter: (p) => evPoints(p.data),
        cellRenderer: (p: any) => `<span class="points">+${Number(p.value ?? 0)}</span>`,
      },
      {
        colId: 'expires',
        ...headerT(this.transloco, 'dashboard.col.expires'),
        width: 190,
        sortable: true,
        valueGetter: (p) => (p.data?.expiresAt ? new Date(p.data.expiresAt).getTime() : 0),
        valueFormatter: (p) => {
          const ev = p.data as EventInstance | undefined;
          if (!ev) return this.transloco.translate('common.emDash');
          return this.endDate(ev);
        },
        cellClass: 'mono muted',
      },
      {
        colId: 'actions',
        ...headerT(this.transloco, 'common.actions'),
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
            span.textContent = this.transloco.translate('common.emDash');
            wrap.appendChild(span);
            return wrap;
          }

          const btn = document.createElement('button');
          btn.className = 'btn-claim';
          btn.type = 'button';
          btn.textContent = this.transloco.translate('dashboard.claim');
          btn.addEventListener('click', () => this.openClaimToast(ev));

          wrap.appendChild(btn);
          return wrap;
        },
      },
    ];

    return {
      id: 'home-events',
      colDefs,
      rowHeight: 72,
      quickFilterPlaceholderKey: 'common.search',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<EventInstance>) => (this.eventsGrid = e.api),
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

  private escapeAttr(s: string) {
    return this.escapeHtml(s).replaceAll('`', '&#096;');
  }
}
