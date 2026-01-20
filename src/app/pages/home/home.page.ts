import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../auth/auth.service';
import { ProductsApi, Product } from '../../api/products.api';
import { UsersApi, type LeaderboardRow } from '../../api/users.api';
import { EventsApi, type EventInstance } from '../../api/events.api';
import { AuctionsApi, type AuctionCard } from '../../api/auctions.api';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';

import { createPagination } from '../../ui/pagination/pagination';
import { UiPagerComponent } from '../../ui/pagination/ui-pager.component';

function parseTimesParam(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function safeStr(v: any) {
  return String(v ?? '').trim();
}

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

function evPoints(ev: any) {
  const p =
    (typeof ev?.points === 'number' ? ev.points : null) ??
    (typeof ev?.pointsApplied === 'number' ? ev.pointsApplied : null) ??
    (typeof ev?.basePoints === 'number' ? ev.basePoints : null) ??
    0;
  return Number(p) || 0;
}

function auctionEndsAt(a: any) {
  return a?.endsAt || a?.auction?.endsAt || a?.ends_at || null;
}

function auctionWinner(a: any) {
  return safeStr(
    a?.winnerNickname ||
    a?.auction?.winnerNickname ||
    a?.lastBidNickname ||
    a?.auction?.lastBidNickname ||
    '',
  );
}

@Component({
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent, UiPagerComponent],
  template: `
    <div class="space-y-6">
      <!-- ✅ 3 tabelas -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Leaders -->
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div class="text-sm text-slate-300">
              Leaders
              @if (leadersLoading()) {
                <span class="ml-2"><ui-spinner [size]="14" text="Carregando..." /></span>
              } @else {
                <span class="text-xs text-slate-500 ml-2">({{ leaders().length }})</span>
              }
            </div>

            <ui-pager
              [canChangePageSize]="false"
              [page]="leadersPage()"
              [totalPages]="leadersTotalPages()"
              [pageSize]="leadersPageSize()"
              [pageSizes]="pageSizes"
              (pageSizeChange)="onLeadersPageSize($event)"
              (prev)="leadersPrev()"
              (next)="leadersNext()"
            />
          </div>

          @if (leadersError()) {
            <div class="p-4 text-red-300">
              {{ leadersError() }}
              <button class="ml-2 underline" (click)="loadLeaders()">tentar novamente</button>
            </div>
          } @else {
            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-900/60 text-slate-300">
                  <tr>
                    <th class="text-left px-4 py-3 w-[54px]">#</th>
                    <th class="text-left px-4 py-3">Nickname</th>
                    <th class="text-left px-4 py-3 w-[110px]">Pontos</th>
                    <th class="text-left px-4 py-3 w-[220px]">Último evento</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-800">
                  @for (r of pagedLeaders(); track $index) {
                    <tr class="hover:bg-slate-900/30 align-middle">
                      <td class="px-4 py-3 text-slate-400 font-mono">
                        {{ ((leadersPage() - 1) * leadersPageSize()) + $index + 1 }}
                      </td>

                      <td class="px-4 py-3">
                        <div class="font-medium text-slate-100">{{ r.nickname }}</div>
                      </td>

                      <td class="px-4 py-3 text-slate-200 font-semibold">{{ r.points }}</td>

                      <td class="px-4 py-3 text-slate-300">
                        <div class="text-slate-200">
                          {{ r.lastEventTitle ?? (r.lastEventDefinitionCode ?? '—') }}
                        </div>
                      </td>
                    </tr>
                  }

                  @if (!leadersLoading() && leaders().length === 0) {
                    <tr>
                      <td colspan="4" class="px-4 py-10 text-center text-slate-400">Sem dados.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Últimos eventos -->
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div class="text-sm text-slate-300">
              Últimos eventos
              @if (eventsLoading()) {
                <span class="ml-2"><ui-spinner [size]="14" text="Carregando..." /></span>
              } @else {
                <span class="text-xs text-slate-500 ml-2">({{ recentEvents().length }})</span>
              }
            </div>

            <ui-pager
            [canChangePageSize]="false"
              [page]="eventsPage()"
              [totalPages]="eventsTotalPages()"
              [pageSize]="eventsPageSize()"
              [pageSizes]="pageSizes"
              (pageSizeChange)="onEventsPageSize($event)"
              (prev)="eventsPrev()"
              (next)="eventsNext()"
            />
          </div>

          @if (eventsError()) {
            <div class="p-4 text-red-300">
              {{ eventsError() }}
              <button class="ml-2 underline" (click)="loadEvents()">tentar novamente</button>
            </div>
          } @else {
            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-900/60 text-slate-300">
                  <tr>
                    <th class="text-left px-4 py-3">Evento</th>
                    <th class="text-left px-4 py-3 w-[110px]">Pontos</th>
                    <th class="text-left px-4 py-3 w-[190px]">Expira</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-800">
                  @for (ev of pagedEvents(); track ev.id) {
                    <tr class="hover:bg-slate-900/30 align-middle">
                      <td class="px-4 py-3">
                        <div class="font-medium text-slate-100">{{ ev.title }}</div>
                        <div class="text-xs text-slate-500 mt-1 font-mono">
                          {{ ev.definitionCode }}
                        </div>
                      </td>

                      <td class="px-4 py-3 text-slate-200">+{{ evPoints(ev) }}</td>

                      <td class="px-4 py-3 text-slate-300 font-mono">
                        {{ fmtDateTimePtBR(ev.expiresAt) }}
                      </td>
                    </tr>
                  }

                  @if (!eventsLoading() && recentEvents().length === 0) {
                    <tr>
                      <td colspan="3" class="px-4 py-10 text-center text-slate-400">Sem eventos.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Últimos leilões -->
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <div class="text-sm text-slate-300">
              Últimos leilões
              @if (auctionsLoading()) {
                <span class="ml-2"><ui-spinner [size]="14" text="Carregando..." /></span>
              } @else {
                <span class="text-xs text-slate-500 ml-2">({{ recentAuctions().length }})</span>
              }
            </div>

            <ui-pager
            [canChangePageSize]="false"
              [page]="auctionsPage()"
              [totalPages]="auctionsTotalPages()"
              [pageSize]="auctionsPageSize()"
              [pageSizes]="pageSizes"
              (pageSizeChange)="onAuctionsPageSize($event)"
              (prev)="auctionsPrev()"
              (next)="auctionsNext()"
            />
          </div>

          @if (auctionsError()) {
            <div class="p-4 text-red-300">
              {{ auctionsError() }}
              <button class="ml-2 underline" (click)="loadAuctions()">tentar novamente</button>
            </div>
          } @else {
            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-900/60 text-slate-300">
                  <tr>
                    <th class="text-left px-4 py-3">Leilão</th>
                    <th class="text-left px-4 py-3 w-[190px]">Fim</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-800">
                  @for (a of pagedAuctions(); track a.id) {
                    <tr class="hover:bg-slate-900/30 align-middle">
                      <td class="px-4 py-3">
                        <div class="font-medium text-slate-100">{{ a.itemName }}</div>

                        <div class="mt-1 flex items-center gap-2">
                          @if (auctionWinner(a)) {
                            <span class="text-xs text-slate-400">
                              Vencedor:
                              <span class="text-slate-200 font-semibold">{{ auctionWinner(a) }}</span>
                            </span>
                          }
                        </div>
                      </td>

                      <td class="px-4 py-3 text-slate-300 font-mono">
                        {{ fmtDateTimePtBR(auctionEndsAt(a)) }}
                      </td>
                    </tr>
                  }

                  @if (!auctionsLoading() && recentAuctions().length === 0) {
                    <tr>
                      <td colspan="2" class="px-4 py-10 text-center text-slate-400">Sem leilões.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class HomePage {
  private auth = inject(AuthService);
  private api = inject(ProductsApi);
  private route = inject(ActivatedRoute);

  private usersApi = inject(UsersApi);
  private eventsApi = inject(EventsApi);
  private auctionsApi = inject(AuctionsApi);

  readonly pageSizes = [10, 15, 20, 25, 30, 35, 50] as const;

  products = signal<Product[]>([]);
  loading = signal(true);
  error = signal('');

  // Leaders
  leaders = signal<LeaderboardRow[]>([]);
  leadersLoading = signal(false);
  leadersError = signal('');

  // Eventos
  allEvents = signal<EventInstance[]>([]);
  eventsLoading = signal(false);
  eventsError = signal('');

  // Leilões
  allAuctions = signal<AuctionCard[]>([]);
  auctionsLoading = signal(false);
  auctionsError = signal('');

  times = signal<number[]>(parseTimesParam(this.route.snapshot.queryParamMap.get('time')));

  userLabel = computed(() => {
    const u = this.auth.userSig();
    return u ? `${u.email} • ${u.scope} • ${u.points} pts` : '';
  });

  filteredProducts = computed(() => {
    const times = this.times();
    const list = this.products();
    if (times.length === 0) return list;

    return list.filter((p) => {
      const uor = p.team?.uor;
      return typeof uor === 'number' && times.includes(uor);
    });
  });

  // ✅ fontes “recentes”
  recentEvents = computed(() => {
    const arr = this.allEvents();
    return [...arr].sort((a: any, b: any) => {
      const ta = new Date((a as any).createdAt ?? (a as any).expiresAt ?? 0).getTime();
      const tb = new Date((b as any).createdAt ?? (b as any).expiresAt ?? 0).getTime();
      return tb - ta;
    });
  });

  recentAuctions = computed(() => {
    const arr = this.allAuctions();
    return [...arr].sort((a: any, b: any) => {
      const ta = new Date((a as any).updatedAt ?? (a as any).endsAt ?? 0).getTime();
      const tb = new Date((b as any).updatedAt ?? (b as any).endsAt ?? 0).getTime();
      return tb - ta;
    });
  });

  // ✅ paginadores (3)
  private leadersPager = createPagination<LeaderboardRow>({
    source: () => this.leaders(),
    pageSizes: this.pageSizes,
    initialPageSize: 10,
  });

  private eventsPager = createPagination<EventInstance>({
    source: () => this.recentEvents(),
    pageSizes: this.pageSizes,
    initialPageSize: 10,
  });

  private auctionsPager = createPagination<AuctionCard>({
    source: () => this.recentAuctions(),
    pageSizes: this.pageSizes,
    initialPageSize: 10,
  });

  // bindings pro template
  leadersPage = this.leadersPager.page;
  leadersPageSize = this.leadersPager.pageSize;
  leadersTotalPages = this.leadersPager.totalPages;
  pagedLeaders = this.leadersPager.paged;

  eventsPage = this.eventsPager.page;
  eventsPageSize = this.eventsPager.pageSize;
  eventsTotalPages = this.eventsPager.totalPages;
  pagedEvents = this.eventsPager.paged;

  auctionsPage = this.auctionsPager.page;
  auctionsPageSize = this.auctionsPager.pageSize;
  auctionsTotalPages = this.auctionsPager.totalPages;
  pagedAuctions = this.auctionsPager.paged;

  constructor() {
    this.route.queryParamMap.subscribe((m) => {
      this.times.set(parseTimesParam(m.get('time')));
    });

    this.loadLeaders();
    this.loadEvents();
    this.loadAuctions();
  }

  reload() {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (data) => this.products.set(data),
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar produtos');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  loadLeaders() {
    this.leadersLoading.set(true);
    this.leadersError.set('');

    this.usersApi.leaderboard(200).subscribe({
      next: (rows) => {
        this.leaders.set(rows ?? []);
        this.leadersPager.reset();
      },
      error: (e) => this.leadersError.set(e?.error?.message ?? 'Falha ao carregar leaders'),
      complete: () => this.leadersLoading.set(false),
    });
  }

  loadEvents() {
    this.eventsLoading.set(true);
    this.eventsError.set('');

    this.eventsApi.listAll().subscribe({
      next: (list) => {
        this.allEvents.set(list ?? []);
        this.eventsPager.reset();
      },
      error: (e) => this.eventsError.set(e?.error?.message ?? 'Falha ao carregar eventos'),
      complete: () => this.eventsLoading.set(false),
    });
  }

  loadAuctions() {
    this.auctionsLoading.set(true);
    this.auctionsError.set('');

    // você está usando list(), mantive
    this.auctionsApi.list().subscribe({
      next: (list: any) => {
        this.allAuctions.set(list ?? []);
        this.auctionsPager.reset();
      },
      error: (e: any) => this.auctionsError.set(e?.error?.message ?? 'Falha ao carregar leilões'),
      complete: () => this.auctionsLoading.set(false),
    });
  }

  // handlers do pager
  onLeadersPageSize(n: number) { this.leadersPager.setPageSize(n); }
  leadersPrev() { this.leadersPager.prev(); }
  leadersNext() { this.leadersPager.next(); }

  onEventsPageSize(n: number) { this.eventsPager.setPageSize(n); }
  eventsPrev() { this.eventsPager.prev(); }
  eventsNext() { this.eventsPager.next(); }

  onAuctionsPageSize(n: number) { this.auctionsPager.setPageSize(n); }
  auctionsPrev() { this.auctionsPager.prev(); }
  auctionsNext() { this.auctionsPager.next(); }

  // helpers usados no template
  fmtDateTimePtBR = fmtDateTimePtBR;
  evPoints = evPoints;
  auctionEndsAt = auctionEndsAt;
  auctionWinner = auctionWinner;
}
