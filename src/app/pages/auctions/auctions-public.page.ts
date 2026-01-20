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
} from '../../api/auctions.api';

import { API_BASE } from '../../api/auctions.api';
import { AuctionsSocketService } from '../../services/auctions-socket.service';
import { AuctionItemCatalogService, type AuctionItemRef } from '../../services/auction-item-catalog.service';

import { AuctionRouletteComponent } from './components/auction-roulette/auction-roulette.component';
import { AuctionClockService } from '../../services/auction-clock.service';

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

function isActiveStatus(s: string) {
  return s === 'ACTIVE' || s === 'FINALIZING' || s === 'TIE_COUNTDOWN' || s === 'TIE_ROLLING';
}

function secondsLeft(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function asStr(v: any) {
  return String(v ?? '').trim();
}

function toInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
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

/**
 * Unidades (mesma tabela que você usa nos presenters)
 * - mantém o padrão de % / ms
 */
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
  imports: [CommonModule, AuctionRouletteComponent],
  templateUrl: './auctions-public.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsPublicPage {
  private api = inject(AuctionsApi);
  private socket = inject(AuctionsSocketService);
  private catalog = inject(AuctionItemCatalogService);
  private clock = inject(AuctionClockService);
  private destroyRef = inject(DestroyRef);

  auctions = signal<AuctionCard[]>([]);
  balance = signal<UserBalanceDto>({ points: 0, reserved: 0, available: 0 });

  isOpen = signal(false);
  openId = signal<number | null>(null);
  details = signal<AuctionDetailsDto | null>(null);

  bidAmount = signal(0);
  bidError = signal<string | null>(null);

  chatText = signal('');
  chatError = signal<string | null>(null);

  roulette = signal<RouletteUi>({ mode: 'none' });

  // ✅ tick baseado no relógio do servidor (offset)
  private tick = signal(this.clock.nowMs());
  private timerId: any = null;

  private pointerDownOnBackdrop = false;

  activeAuctions = computed(() =>
    this.auctions()
      .filter((a) => isActiveStatus(a.status) && !a.isCanceled)
      .sort((x, y) => parseMs(x.endsAt) - parseMs(y.endsAt)),
  );

  finishedAuctions = computed(() =>
    this.auctions()
      .filter((a) => !isActiveStatus(a.status) || a.isCanceled)
      .sort((x, y) => parseMs(y.createdAt) - parseMs(x.createdAt)),
  );

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

  private itemRefFromAuction(a: { itemType?: any; itemId?: any }): AuctionItemRef | null {
    const t = asStr(a.itemType);
    const id = toInt(a.itemId);
    if (!t || !id) return null;
    if (t !== 'weapon' && t !== 'armor' && t !== 'accessory') return null;
    return { itemType: t as any, itemId: id, slot: undefined };
  }

  chipsForCard(a: AuctionCard): string[] {
    const ref = this.itemRefFromAuction(a as any);
    if (!ref) return [];
    const it = this.catalog.find(ref);
    const fx = (it?.effects ?? [])
      .filter((e) => asStr((e as any).label) && Number((e as any).value) !== 0)
      .map((e) => {
        const label = asStr((e as any).label);
        const val = formatEffectValue(label, (e as any).value);
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

    const ref = this.itemRefFromAuction(d.auction as any);
    const fromCatalog = ref ? this.catalog.find(ref)?.imagePath ?? null : null;

    const raw = fromCatalog || (d.auction as any).itemImagePath;
    return normalizeImgSrc(raw);
  });

  modalItemName = computed(() => {
    const d = this.details();
    if (!d) return '—';

    const ref = this.itemRefFromAuction(d.auction as any);
    const fromCatalog = ref ? this.catalog.find(ref)?.name : null;

    return asStr(fromCatalog || (d.auction as any).itemName || '—');
  });

  constructor() {
    // ✅ 1) Sync relógio com backend HTTP (resolve PC atrasado/adiantado)
    this.api.time().subscribe({
      next: (t) => {
        this.clock.setServerTimeMs(t.serverTimeMs);
        this.tick.set(this.clock.nowMs());
      },
      error: () => {
        // se falhar, cai no Date.now() mesmo (não trava app)
        this.tick.set(Date.now());
      },
    });

    this.reload();

    // ✅ tick usando server clock
    this.timerId = setInterval(() => this.tick.set(this.clock.nowMs()), 250);

    this.catalog.loadAll(false).subscribe({ next: () => {}, error: () => {} });

    this.socket.connect();

    this.socket
      .onAuctionCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => this.upsertAuction(a));

    this.socket
      .onAuctionUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => {
        this.upsertAuction(a);

        const id = this.openId();
        const d = this.details();
        if (id && d && a.id === id) {
          this.details.set({ ...d, auction: a });

          if (a.status === 'TIE_COUNTDOWN') {
            const r = this.roulette();
            if (r.mode === 'none') {
              this.refreshDetailsForTie(id);
            }
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
        this.auctions.set(this.auctions().filter((x) => x.id !== p.id));
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
        const nextMsgs = exists ? d.messages : [...d.messages, message];
        this.details.set({ ...d, messages: nextMsgs });
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

    this.api.balance().subscribe({ next: (b) => this.balance.set(b), error: () => {} });

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

  onBackdropPointerDown(_e: PointerEvent) {
    this.pointerDownOnBackdrop = true;
  }

  onBackdropPointerUp(_e: PointerEvent) {
    if (this.pointerDownOnBackdrop) this.close();
    this.pointerDownOnBackdrop = false;
  }

  reload() {
    this.api.list().subscribe({ next: (list) => this.auctions.set(list), error: () => {} });
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

  // ✅ countdown sempre pelo server-clock (tick já é server-based)
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
    const ref = this.itemRefFromAuction(a as any);
    const fromCatalog = ref ? this.catalog.find(ref)?.imagePath ?? null : null;
    const raw = fromCatalog || (a as any).itemImagePath;
    return normalizeImgSrc(raw);
  }

  displayItemName(a: AuctionCard) {
    const ref = this.itemRefFromAuction(a as any);
    const fromCatalog = ref ? this.catalog.find(ref)?.name : null;
    return asStr(fromCatalog || (a as any).itemName || '—');
  }

  // ✅ sempre Brasília (independente do PC)
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

    if (ack.auction) {
      this.upsertAuction(ack.auction);
      this.details.set({ ...this.details()!, auction: ack.auction });
    }

    this.api.details(id).subscribe({
      next: (nd) => {
        this.details.set(nd);
        this.applyTieUiFromDetails(nd);
      },
      error: () => {},
    });

    this.api.balance().subscribe({ next: (b) => this.balance.set(b), error: () => {} });
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

  private upsertAuction(a: AuctionCard) {
    const list = this.auctions();
    const idx = list.findIndex((x) => x.id === a.id);
    if (idx === -1) {
      this.auctions.set([a, ...list]);
      return;
    }
    const next = list.slice();
    next[idx] = { ...next[idx], ...a };
    this.auctions.set(next);
  }
}
