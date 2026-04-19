import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { type LeaderboardRow } from '../../api/users.api';
import { ListViewsCacheService } from '../../services/list-views-cache.service';

import { DataTableComponent } from '../../shared/table/data-table.component';
import type { DataTableConfig } from '../../shared/table/table.types';
import { headerT } from '../../shared/table/table-i18n';

import { discordAvatarUrl } from '../../utils/discord-avatar';

function safeStr(v: any) {
  return String(v ?? '').trim();
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent, TranslocoPipe],
  templateUrl: './members.page.html',
  styleUrl: './members.page.scss',
})
export class MembersPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly listCache = inject(ListViewsCacheService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  list = signal<LeaderboardRow[]>([]);
  loading = signal(false);
  error = signal('');

  private gridApi?: GridApi<LeaderboardRow>;
  tableConfig!: DataTableConfig<LeaderboardRow>;

  constructor() {
    this.tableConfig = this.buildTable();
    this.load();

    effect(() => {
      this.langTick();
      this.tableConfig = this.buildTable();
      queueMicrotask(() => this.gridApi?.setGridOption('columnDefs', this.tableConfig.colDefs));
    });

    effect(() => {
      this.loading();
      this.error();
      this.gridApi?.refreshCells({ force: true });
    });
  }

  load() {
    const limit = 200;
    const cached = this.listCache.peekLeaderboard(limit);
    if (cached) {
      this.list.set(cached);
      queueMicrotask(() => this.gridApi?.refreshCells({ force: true }));
    } else {
      this.loading.set(true);
    }
    this.error.set('');

    this.listCache.loadLeaderboard(limit).subscribe({
      next: (rows) => this.list.set(rows ?? []),
      error: (e) =>
        this.error.set(e?.error?.message ?? this.transloco.translate('members.errLoad')),
      complete: () => this.loading.set(false),
    });
  }

  openMember(userId: number) {
    const n = Number(userId);
    if (!Number.isFinite(n) || n <= 0) return;
    this.router.navigate(['/members', n]);
  }

  avatar(r: LeaderboardRow) {
    return discordAvatarUrl(
      {
        discordId: r.discordId,
        discordAvatar: r.discordAvatar,
        discordDiscriminator: r.discordDiscriminator,
      },
      40,
    );
  }

  private buildTable(): DataTableConfig<LeaderboardRow> {
    const colDefs: ColDef<LeaderboardRow>[] = [
      {
        headerName: '#',
        width: 70,
        sortable: true,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        cellClass: 'mono muted',
      },
      {
        colId: 'member',
        ...headerT(this.transloco, 'members.col.member'),
        minWidth: 280,
        flex: 1,
        sortable: true,
        valueGetter: (p) => safeStr(p.data?.nickname),
        cellRenderer: (p: any) => {
          const r = p.data as LeaderboardRow | undefined;
          if (!r) return '';

          const nick = this.escapeHtml(safeStr(r.nickname));
          const avatar = this.avatar(r);

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
        width: 130,
        sortable: true,
        cellRenderer: (p: any) => `<span class="points">${Number(p.value ?? 0)}</span>`,
      },
      {
        colId: 'lastEvent',
        ...headerT(this.transloco, 'members.col.lastEvent'),
        minWidth: 260,
        flex: 1,
        sortable: false,
        valueGetter: (p) =>
          safeStr((p.data as any)?.lastEventTitle ?? (p.data as any)?.lastEventDefinitionCode ?? ''),
        cellRenderer: (p: any) => {
          const dash = this.transloco.translate('common.emDash');
          const v = this.escapeHtml(String(p.value ?? dash)) || dash;
          return `<span class="muted" title="${v}">${v}</span>`;
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

          btn.addEventListener('click', () => {
            const uid = Number((r as any).userId ?? (r as any).id);
            this.openMember(uid);
          });

          return btn;
        },
      },
    ];

    return {
      id: 'members-leaderboard',
      colDefs,
      rowHeight: 60,
      quickFilterPlaceholderKey: 'common.search',
      gridOptions: {
        onGridReady: (e: GridReadyEvent<LeaderboardRow>) => (this.gridApi = e.api),
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