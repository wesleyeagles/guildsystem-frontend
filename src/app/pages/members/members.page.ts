import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import { UsersApi, type LeaderboardRow } from '../../api/users.api';

import { DataTableComponent } from '../../shared/table/data-table.component';
import type { DataTableConfig } from '../../shared/table/table.types';

import { discordAvatarUrl } from '../../utils/discord-avatar';

function safeStr(v: any) {
  return String(v ?? '').trim();
}

@Component({
  standalone: true,
  imports: [CommonModule, DataTableComponent],
  templateUrl: './members.page.html',
  styleUrl: './members.page.scss',
})
export class MembersPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(UsersApi);
  private readonly router = inject(Router);

  list = signal<LeaderboardRow[]>([]);
  loading = signal(false);
  error = signal('');

  private gridApi?: GridApi<LeaderboardRow>;
  tableConfig!: DataTableConfig<LeaderboardRow>;

  constructor() {
    this.tableConfig = this.buildTable();
    this.load();

    effect(() => {
      this.loading();
      this.error();
      this.gridApi?.refreshCells({ force: true });
    });
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.leaderboard(200).subscribe({
      next: (rows) => this.list.set(rows ?? []),
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar membros'),
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
        headerName: 'Membro',
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
        headerName: 'Pontos',
        field: 'points' as any,
        width: 130,
        sortable: true,
        cellRenderer: (p: any) => `<span class="points">${Number(p.value ?? 0)}</span>`,
      },
      {
        headerName: 'Último evento',
        minWidth: 260,
        flex: 1,
        sortable: false,
        valueGetter: (p) =>
          safeStr((p.data as any)?.lastEventTitle ?? (p.data as any)?.lastEventDefinitionCode ?? ''),
        cellRenderer: (p: any) => {
          const v = this.escapeHtml(String(p.value ?? '—')) || '—';
          return `<span class="muted" title="${v}">${v}</span>`;
        },
      },
      {
        headerName: 'Ações',
        colId: 'actions',
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
          btn.title = 'Ver';

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
      quickFilterPlaceholder: 'Buscar...',
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