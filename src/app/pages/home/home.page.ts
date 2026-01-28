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
import { EventToastManager } from '../../events/event-toast.manager';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../ui/toast/toast.service';

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

function nowMs() { return Date.now(); }
function ended(ev: EventInstance) { return new Date(ev.expiresAt).getTime() <= nowMs(); }
function cancelled(ev: EventInstance) { return Boolean((ev as any).isCanceled) || Boolean(ev.canceledAt); }
function active(ev: EventInstance) { return !cancelled(ev) && !ended(ev); }

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
  imports: [CommonModule, UiSpinnerComponent, UiPagerComponent, ReactiveFormsModule],
  templateUrl: './home.page.html',
})
export class HomePage {
  private auth = inject(AuthService);
  private api = inject(ProductsApi);
  private route = inject(ActivatedRoute);

  private manager = inject(EventToastManager);
  private toast = inject(ToastService);


  private usersApi = inject(UsersApi);
  private eventsApi = inject(EventsApi);
  private auctionsApi = inject(AuctionsApi);

  readonly pageSizes = [8, 15, 20, 25, 30, 35, 50] as const;
  readonly pageSizesAuction = [3, 10, 15, 20, 25, 30, 40] as const;

  products = signal<Product[]>([]);
  loading = signal(true);
  error = signal('');

  leaders = signal<LeaderboardRow[]>([]);
  leadersLoading = signal(false);
  leadersError = signal('');

  allEvents = signal<EventInstance[]>([]);
  eventsLoading = signal(false);
  eventsError = signal('');

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
    initialPageSize: 8,
  });

  private eventsPager = createPagination<EventInstance>({
    source: () => this.recentEvents(),
    pageSizes: this.pageSizes,
    initialPageSize: 8,
  });

  private auctionsPager = createPagination<AuctionCard>({
    source: () => this.recentAuctions(),
    pageSizes: this.pageSizesAuction,
    initialPageSize: 3,
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

  isAdmin = computed(() => this.auth.userSig()?.scope === 'admin');

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

  cancelModalOpen = signal(false);
  cancelTarget = signal<EventInstance | null>(null);
  cancelReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)],
  });
  canceling = signal(false);
  cancelError = signal('');

  isCancellableRow(ev: EventInstance) {
    // mesma ideia do admin: ativo OU finalizado, desde que não esteja cancelado
    return this.isActive(ev) || (ended(ev) && !this.isCancelled(ev));
  }

  openCancel(ev: EventInstance) {
    this.cancelTarget.set(ev);
    this.cancelReason.reset('');
    this.cancelError.set('');
    this.cancelModalOpen.set(true);
  }

  closeCancel(force = false) {
    if (!force && this.canceling()) return;
    this.cancelModalOpen.set(false);
    this.cancelTarget.set(null);
  }

  confirmCancel() {
    const ev = this.cancelTarget();
    if (!ev) return;
    if (this.cancelReason.invalid || this.canceling()) return;

    this.canceling.set(true);
    this.cancelError.set('');

    this.eventsApi.cancel(ev.id, this.cancelReason.value).subscribe({
      next: () => {
        this.toast.success('Evento cancelado.');
        this.closeCancel(true);
        this.loadEvents();
      },
      error: (e) => {
        this.cancelError.set(e?.error?.message ?? 'Falha ao cancelar evento');
      },
      complete: () => this.canceling.set(false),
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

  isActive(ev: EventInstance) { return active(ev); }
  isCancelled(ev: EventInstance) { return cancelled(ev); }

  isClaimed(ev: EventInstance) {
    return Boolean(ev.claimedByMe) || this.manager.isClaimed(ev.id);
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
