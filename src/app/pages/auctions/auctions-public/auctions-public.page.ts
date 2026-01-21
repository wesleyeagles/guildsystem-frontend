// src/app/pages/auctions/auctions-public.page.ts
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  AuctionsApi,
  type AuctionCard,
  type AuctionDetailsDto,
  type UserBalanceDto,
  API_BASE,
} from '../../../api/auctions.api';
import { AuctionRouletteComponent } from '../components/auction-roulette/auction-roulette.component';
import { AuctionsPagerComponent } from '../components/auctions-pager/auctions-pager.component';
import { AuctionsSocketService } from '../../../services/auctions-socket.service';
import { AuctionClockService } from '../../../services/auction-clock.service';


const BR_TZ = 'America/Sao_Paulo';

function parseMs(iso: string | null | undefined) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function fmtTimeLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s`;
  return `${m}m ${String(ss).padStart(2, '0')}s`;
}

function secondsLeft(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function asStr(v: any) {
  return String(v ?? '').trim();
}

function normalizeImgSrc(src: string | null | undefined) {
  const s = asStr(src);
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;

  const base = API_BASE.replace(/\/$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${base}${path}`;
}

function formatBRDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';

  const d = new Date(ms);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatBRTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  const d = new Date(ms);

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

type UnitKind = 'none' | 'percent' | 'ms' | 'string';
const EFFECT_UNIT_BY_LABEL: Record<string, UnitKind> = {
  'Max. SP': 'percent',
  'FP Consumption': 'percent',
  'Max. HP/FP': 'percent',
  Attack: 'percent',
  Defense: 'percent',
  'Level up skills by': 'none',
  Detect: 'none',
  Vampiric: 'percent',
  'Force Attack': 'percent',
  'Critical Chance': 'percent',
  'Block Chance': 'percent',
  'Max. HP': 'percent',
  'Max. FP': 'percent',
  'Debuff Duration': 'percent',
  'Ignore Block Chance': 'percent',
  'Movement Speed': 'none',
  'Launcher Attack Delay': 'ms',
  'Force Skill Delay': 'ms',
};

function unitKind(label: string): UnitKind {
  return EFFECT_UNIT_BY_LABEL[asStr(label)] ?? 'none';
}

function formatEffectValue(label: string, rawValue: any) {
  const kind = unitKind(label);
  const value = Number(rawValue);
  const abs = Number.isFinite(value) ? Math.abs(value) : 0;
  const sign = value < 0 ? '-' : '+';

  if (kind === 'percent') {
    const v = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
    return `${sign}${v}%`;
  }
  if (kind === 'ms') {
    const v = String(Math.round(abs));
    return `${sign}${v}ms`;
  }
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  return `${sign}${abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
}

type RouletteUi =
  | { mode: 'none' }
  | { mode: 'countdown'; endsAtMs: number; participants: string[] }
  | {
      mode: 'rolling';
      participants: string[];
      seed: string;
      winnerIndex: number;
      durationMs: number;
      amount: number;
      finishedName?: string;
    };

@Component({
  selector: 'app-auctions-public-page',
  standalone: true,
  imports: [CommonModule, AuctionRouletteComponent, AuctionsPagerComponent],
  templateUrl: './auctions-public.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsPublicPage {
  private api = inject(AuctionsApi);
  private socket = inject(AuctionsSocketService);
  private clock = inject(AuctionClockService);
  private destroyRef = inject(DestroyRef);

  // ✅ server pagination sizes (use as suas)
  readonly pageSizes = [3, 10, 15, 20, 25, 30, 35] as const;

  // ✅ listas paginadas vindas do servidor
  activeItems = signal<AuctionCard[]>([]);
  finishedItems = signal<AuctionCard[]>([]);

  activeTotal = signal(0);
  activeTotalPages = signal(1);
  finishedTotal = signal(0);
  finishedTotalPages = signal(1);

  activePage = signal(1);
  activePageSize = signal<number>(3);

  finishedPage = signal(1);
  finishedPageSize = signal<number>(3);

  balance = signal<UserBalanceDto>({ points: 0, reserved: 0, available: 0 });

  isOpen = signal(false);
  openId = signal<number | null>(null);
  details = signal<AuctionDetailsDto | null>(null);

  bidAmount = signal(0);
  bidError = signal<string | null>(null);

  chatText = signal('');
  chatError = signal<string | null>(null);

  roulette = signal<RouletteUi>({ mode: 'none' });

  // ✅ menos re-render: 1s já é ótimo (250ms é caro no client)
  private tick = signal(this.clock.nowMs());
  private timerId: any = null;

  private pointerDownOnBackdrop = false;

  // usados pelo template (mantém compatibilidade)
  activeAuctions = computed(() => this.activeItems());
  finishedAuctions = computed(() => this.finishedItems());

  activePaged = computed(() => this.activeItems());
  finishedPaged = computed(() => this.finishedItems());

  modalMessages = computed(() => this.details()?.messages ?? []);

  isTopLocked = computed(() => {
    const d = this.details();
    if (!d) return false;
    const current = d.auction.currentBidAmount ?? 0;
    if (current <= 0) return false;
    if ((d.auction.tieCount ?? 0) !== 1) return false;
    return (d.myHold ?? 0) === current;
  });

  tieCountdownSeconds = computed(() => {
    const r = this.roulette();
    if (r.mode !== 'countdown') return 0;
    return secondsLeft(r.endsAtMs - this.tick());
  });

  /**
   * ✅ PERFORMANCE:
   * Removido o `catalog.loadAll()` e os `catalog.find()` (isso estava puxando catálogo gigante).
   * Agora a página usa o snapshot do leilão: `itemName` e `itemImagePath`.
   *
   * Chips: só aparecem se o backend enviar algum preview (ex: `itemEffects`), senão fica vazio.
   */
  private normalizeEffectsFromAny(a: any): { label: string; value: number }[] {
    const raw = (a?.itemEffects ?? a?.effects ?? a?.catalogEffects ?? []) as any[];
    if (!Array.isArray(raw)) return [];

    const out: { label: string; value: number }[] = [];
    for (const e of raw) {
      // formato "catalog": { label, value }
      if (asStr(e?.label)) {
        const v = Number(e?.value);
        if (!Number.isFinite(v) || v === 0) continue;
        out.push({ label: asStr(e.label), value: v });
        continue;
      }

      // formato "weapon": { effect, value, typeNum: Increase|Decrease }
      if (asStr(e?.effect)) {
        const v0 = Number(e?.value);
        if (!Number.isFinite(v0) || v0 === 0) continue;
        const t = asStr(e?.typeNum).toLowerCase();
        const signed = t === 'decrease' ? -Math.abs(v0) : Math.abs(v0);
        out.push({ label: asStr(e.effect), value: signed });
        continue;
      }
    }

    return out;
  }

  chipsForCard(a: AuctionCard): string[] {
    const fx = this.normalizeEffectsFromAny(a as any)
      .filter((e) => asStr(e.label) && Number(e.value) !== 0)
      .map((e) => {
        const label = asStr(e.label);
        const val = formatEffectValue(label, e.value);
        return `${label} ${val}`.trim();
      });

    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of fx) {
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  }

  modalChips = computed(() => {
    const d = this.details();
    if (!d) return [];
    return this.chipsForCard(d.auction as any);
  });

  modalImage = computed(() => {
    const d = this.details();
    if (!d) return null;
    return normalizeImgSrc((d.auction as any).itemImagePath ?? null);
  });

  modalItemName = computed(() => {
    const d = this.details();
    if (!d) return '—';
    return asStr((d.auction as any).itemName || '—');
  });

  constructor() {
    this.api.time().subscribe({
      next: (t) => {
        this.clock.setServerTimeMs(t.serverTimeMs);
        this.tick.set(this.clock.nowMs());
      },
      error: () => {
        this.tick.set(Date.now());
      },
    });

    // ✅ fetch inicial paginado
    this.loadActive();
    this.loadFinished();
    this.api.balance().subscribe({ next: (b) => this.balance.set(b), error: () => {} });

    // ✅ tick 1s (muito mais leve)
    this.timerId = setInterval(() => this.tick.set(this.clock.nowMs()), 1000);

    this.socket.connect();

    // ✅ Atualizações WS: mantemos, e refletimos na lista paginada atual quando afetar
    this.socket
      .onAuctionCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => this.patchListsWithIncoming(a));

    this.socket
      .onAuctionUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => {
        this.patchListsWithIncoming(a);

        const id = this.openId();
        const d = this.details();
        if (id && d && a.id === id) {
          this.details.set({ ...d, auction: a });

          if (a.status === 'TIE_COUNTDOWN') {
            const r = this.roulette();
            if (r.mode === 'none') this.refreshDetailsForTie(id);
          }

          if (a.status !== 'TIE_COUNTDOWN' && a.status !== 'TIE_ROLLING') {
            const r = this.roulette();
            if (r.mode !== 'rolling') {
              if (r.mode !== 'none') this.roulette.set({ mode: 'none' });
            }
          }
        }
      });

    this.socket
      .onAuctionDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        this.activeItems.set(this.activeItems().filter((x) => x.id !== p.id));
        this.finishedItems.set(this.finishedItems().filter((x) => x.id !== p.id));
        if (this.openId() === p.id) this.close();
      });

    this.socket
      .onUserBalance()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((b) => this.balance.set(b));

    this.socket
      .onRouletteStart()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ auctionId, payload }) => {
        const id = this.openId();
        if (!id || auctionId !== id) return;

        this.roulette.set({
          mode: 'rolling',
          participants: payload.participants.map((p) => p.nickname),
          seed: payload.seed,
          winnerIndex: payload.winnerIndex,
          durationMs: payload.durationMs,
          amount: payload.amount,
        });
      });

    this.socket
      .onAuctionMessage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ auctionId, message }) => {
        const id = this.openId();
        if (!id || auctionId !== id) return;

        const d = this.details();
        if (!d) return;

        const exists = d.messages.some((m) => m.id === message.id);
        if (exists) return;
        this.details.set({ ...d, messages: [...d.messages, message] });
      });

    this.socket
      .onAuctionFinished()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ auctionId }) => {
        const id = this.openId();
        if (!id || auctionId !== id) return;

        const r = this.roulette();
        if (r.mode === 'rolling') return;

        this.roulette.set({ mode: 'none' });
      });

    effect(() => {
      const d = this.details();
      if (!d) return;
      const current = d.auction.currentBidAmount ?? 0;
      const v = this.bidAmount();
      if (!v || v < current) this.bidAmount.set(current);
    });
  }

  ngOnDestroy() {
    if (this.timerId) clearInterval(this.timerId);
  }

  // ---- server pagination handlers ----
  onActiveChangePageSize(size: number) {
    this.activePageSize.set(size);
    this.activePage.set(1);
    this.loadActive();
  }
  activePrevPage() {
    if (this.activePage() <= 1) return;
    this.activePage.set(this.activePage() - 1);
    this.loadActive();
  }
  activeNextPage() {
    if (this.activePage() >= this.activeTotalPages()) return;
    this.activePage.set(this.activePage() + 1);
    this.loadActive();
  }

  onFinishedChangePageSize(size: number) {
    this.finishedPageSize.set(size);
    this.finishedPage.set(1);
    this.loadFinished();
  }
  finishedPrevPage() {
    if (this.finishedPage() <= 1) return;
    this.finishedPage.set(this.finishedPage() - 1);
    this.loadFinished();
  }
  finishedNextPage() {
    if (this.finishedPage() >= this.finishedTotalPages()) return;
    this.finishedPage.set(this.finishedPage() + 1);
    this.loadFinished();
  }

  private loadActive() {
    this.api
      .listPage({ group: 'active', page: this.activePage(), pageSize: this.activePageSize() })
      .subscribe({
        next: (res) => {
          this.activeItems.set(res.items);
          this.activeTotal.set(res.total);
          this.activeTotalPages.set(res.totalPages);
          this.activePage.set(res.page);
        },
        error: () => {},
      });
  }

  private loadFinished() {
    this.api
      .listPage({ group: 'finished', page: this.finishedPage(), pageSize: this.finishedPageSize() })
      .subscribe({
        next: (res) => {
          this.finishedItems.set(res.items);
          this.finishedTotal.set(res.total);
          this.finishedTotalPages.set(res.totalPages);
          this.finishedPage.set(res.page);
        },
        error: () => {},
      });
  }

  // ✅ tenta refletir updates WS sem recarregar tudo
  private patchListsWithIncoming(a: AuctionCard) {
    const isCanceled = !!a.isCanceled;
    const isActive =
      !isCanceled &&
      (a.status === 'ACTIVE' ||
        a.status === 'FINALIZING' ||
        a.status === 'TIE_COUNTDOWN' ||
        a.status === 'TIE_ROLLING');
    const isFinished = !isActive;

    const patch = (list: AuctionCard[]) => {
      const idx = list.findIndex((x) => x.id === a.id);
      if (idx === -1) return list;
      const next = list.slice();
      next[idx] = { ...next[idx], ...a };
      return next;
    };

    // se existir na lista atual, patch
    this.activeItems.set(patch(this.activeItems()));
    this.finishedItems.set(patch(this.finishedItems()));

    // se mudou de grupo, recarrega só a página atual (bem mais barato que reload total)
    if (isActive) {
      const inActive = this.activeItems().some((x) => x.id === a.id);
      const inFinished = this.finishedItems().some((x) => x.id === a.id);
      if (!inActive && inFinished) this.loadActive();
      if (inFinished) this.loadFinished();
    } else if (isFinished) {
      const inActive = this.activeItems().some((x) => x.id === a.id);
      const inFinished = this.finishedItems().some((x) => x.id === a.id);
      if (!inFinished && inActive) this.loadFinished();
      if (inActive) this.loadActive();
    }
  }

  onBackdropPointerDown(_e: PointerEvent) {
    this.pointerDownOnBackdrop = true;
  }

  onBackdropPointerUp(_e: PointerEvent) {
    if (this.pointerDownOnBackdrop) this.close();
    this.pointerDownOnBackdrop = false;
  }

  reload() {
    this.loadActive();
    this.loadFinished();
    this.api.balance().subscribe({ next: (b) => this.balance.set(b), error: () => {} });
  }

  open(id: number) {
    this.isOpen.set(true);
    this.openId.set(id);
    this.bidError.set(null);
    this.chatError.set(null);
    this.roulette.set({ mode: 'none' });

    this.api.details(id).subscribe({
      next: async (d) => {
        this.details.set(d);
        this.bidAmount.set(d.auction.currentBidAmount ?? 0);

        await this.socket.joinAuction(id);
        this.applyTieUiFromDetails(d);
      },
      error: () => this.close(),
    });
  }

  private applyTieUiFromDetails(d: AuctionDetailsDto) {
    const status = d.auction.status;

    if (status === 'TIE_COUNTDOWN' && d.tie?.endsAt && d.tie.participants?.length) {
      this.roulette.set({
        mode: 'countdown',
        endsAtMs: parseMs(d.tie.endsAt),
        participants: d.tie.participants.map((p) => p.nickname),
      });
      return;
    }

    if (status === 'TIE_ROLLING' && d.tie?.participants?.length) {
      this.roulette.set({
        mode: 'countdown',
        endsAtMs: this.clock.nowMs() + 1000,
        participants: d.tie.participants.map((p) => p.nickname),
      });
      return;
    }

    this.roulette.set({ mode: 'none' });
  }

  private refreshDetailsForTie(id: number) {
    this.api.details(id).subscribe({
      next: (nd) => {
        this.details.set(nd);
        this.applyTieUiFromDetails(nd);
      },
      error: () => {},
    });
  }

  async close() {
    const id = this.openId();
    if (id) await this.socket.leaveAuction(id);

    this.isOpen.set(false);
    this.openId.set(null);
    this.details.set(null);
    this.bidAmount.set(0);
    this.bidError.set(null);
    this.chatText.set('');
    this.chatError.set(null);
    this.roulette.set({ mode: 'none' });
    this.pointerDownOnBackdrop = false;
  }

  timeLeftFor(a: AuctionCard) {
    const end = parseMs(a.endsAt);
    const left = end - this.tick();
    return fmtTimeLeft(left);
  }

  modalTimeLeft() {
    const end = parseMs(this.details()?.auction?.endsAt ?? null);
    const left = end - this.tick();
    return fmtTimeLeft(left);
  }

  shortTime(iso: string) {
    return formatBRTime(iso);
  }

  displayImage(a: AuctionCard) {
    return normalizeImgSrc((a as any).itemImagePath ?? null);
  }

  displayItemName(a: AuctionCard) {
    return asStr((a as any).itemName || '—');
  }

  brStartsAt(a: AuctionCard | null | undefined) {
    return formatBRDateTime(a?.startsAt);
  }

  brEndsAt(a: AuctionCard | null | undefined) {
    return formatBRDateTime(a?.endsAt);
  }

  canBid() {
    const d = this.details();
    if (!d) return false;

    const s = d.auction.status;
    if (s === 'CANCELED' || s === 'FINISHED') return false;
    if (s === 'TIE_COUNTDOWN' || s === 'TIE_ROLLING') return false;

    if (this.isTopLocked()) return false;
    return true;
  }

  canSubmitBid() {
    if (!this.canBid()) return false;
    const d = this.details();
    if (!d) return false;

    const v = Number(this.bidAmount());
    if (!Number.isFinite(v) || v <= 0) return false;

    const current = d.auction.currentBidAmount ?? 0;
    if (v < current) return false;

    return true;
  }

  canAllIn() {
    if (!this.canBid()) return false;
    const d = this.details();
    if (!d) return false;
    const max = this.balance().available + (d.myHold ?? 0);
    return max > 0;
  }

  preset(delta: number) {
    const d = this.details();
    if (!d) return;
    const current = d.auction.currentBidAmount ?? 0;
    this.bidAmount.set(current + delta);
  }

  allIn() {
    const d = this.details();
    if (!d) return;
    const max = this.balance().available + (d.myHold ?? 0);
    this.bidAmount.set(max);
  }

  async submitBid() {
    this.bidError.set(null);

    const id = this.openId();
    const d = this.details();
    if (!id || !d) return;

    const amount = Number(this.bidAmount());
    if (!Number.isFinite(amount) || amount <= 0) return;

    const ack = await this.socket.bid(id, amount);
    if (!ack.ok) {
      this.bidError.set(ack.error ?? 'Erro ao dar lance');
      return;
    }

    // ✅ remove requests extras (DETALHES + BALANCE)
    // O servidor já emite: AUCTION_UPDATED, MESSAGE e USER_BALANCE via websocket.
    // Aqui a gente só atualiza o mínimo pra UI responder rápido.
    if (ack.auction) {
      this.details.set({ ...this.details()!, auction: ack.auction });
      this.patchListsWithIncoming(ack.auction);
    }
  }

  async sendChat() {
    this.chatError.set(null);

    const id = this.openId();
    const text = this.chatText().trim();
    if (!id || !text) return;

    const ack = await this.socket.chat(id, text);
    if (!ack.ok) {
      this.chatError.set(ack.error ?? 'Erro no chat');
      return;
    }

    this.chatText.set('');
  }

  onRouletteFinished(ev: { winnerIndex: number; winnerName: string }) {
    const r = this.roulette();
    if (r.mode !== 'rolling') return;

    this.roulette.set({
      ...r,
      finishedName: ev.winnerName,
    });
  }
}
