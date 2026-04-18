// auctions-public.page.ts
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

import {
  AuctionsApi,
  type AuctionCard,
  type AuctionDetailsDto,
  type AuctionMessageDto,
  type AuctionMessageReactionDto,
  type UserBalanceDto,
  API_BASE,
} from '../../../api/auctions.api';

import { AuctionRouletteComponent } from '../components/auction-roulette/auction-roulette.component';
import { AuctionsSocketService } from '../../../services/auctions-socket.service';
import { AuctionClockService } from '../../../services/auction-clock.service';
import { UiEmojiTooltipComponent } from '../../../ui/emoji-react-button/ui-emoji-react-button.component';

import { DataTableComponent } from '../../../shared/table/data-table.component';
import type { DataTableConfig } from '../../../shared/table/table.types';

const BR_TZ = 'America/Sao_Paulo';
const ACTIVE_PAGE_SIZE = 25;

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
  const p = s.startsWith('/') ? s : `/${s}`;
  return `${base}${p}`;
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
  imports: [CommonModule, AuctionRouletteComponent, UiEmojiTooltipComponent, DataTableComponent, TranslocoPipe],
  styleUrl: './auctions-public.page.scss',
  templateUrl: './auctions-public.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsPublicPage {
  private api = inject(AuctionsApi);
  private socket = inject(AuctionsSocketService);
  private clock = inject(AuctionClockService);
  private destroyRef = inject(DestroyRef);
  private transloco = inject(TranslocoService);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  activeItems = signal<AuctionCard[]>([]);
  activeLoading = signal(false);
  activeError = signal<string | null>(null);

  balance = signal<UserBalanceDto>({ points: 0, reserved: 0, available: 0 });

  isOpen = signal(false);
  openId = signal<number | null>(null);
  details = signal<AuctionDetailsDto | null>(null);

  bidAmount = signal(0);
  bidError = signal<string | null>(null);

  chatText = signal('');
  chatError = signal<string | null>(null);

  chatFile = signal<File | null>(null);
  chatUploading = signal(false);

  roulette = signal<RouletteUi>({ mode: 'none' });

  private tick = signal(this.clock.nowMs());
  private timerId: any = null;

  private pointerDownOnBackdrop = false;

  private activeGridApi?: GridApi<AuctionCard>;

  activeTableConfig: DataTableConfig<AuctionCard>;

  activePaged = computed(() => this.activeItems());

  modalMessages = computed(() => this.details()?.messages ?? []);

  isTopLocked = computed(() => {
    const d = this.details();
    if (!d) return false;

    const current = d.auction.currentBidAmount ?? 0;
    if (current <= 0) return false;

    const tieCount = Number(d.auction.tieCount ?? 0);
    if (tieCount !== 1) return false;

    return (d.myHold ?? 0) === current;
  });

  tieCountdownSeconds = computed(() => {
    const r = this.roulette();
    if (r.mode !== 'countdown') return 0;
    return secondsLeft(r.endsAtMs - this.tick());
  });

  constructor() {
    this.activeTableConfig = this.buildActiveTable();

    effect(() => {
      this.langTick();
      this.activeTableConfig = this.buildActiveTable();
      queueMicrotask(() => this.activeGridApi?.setGridOption('columnDefs', this.activeTableConfig.colDefs));
    });

    this.api.time().subscribe({
      next: (t) => {
        this.clock.setServerTimeMs(t.serverTimeMs);
        this.tick.set(this.clock.nowMs());
      },
      error: () => this.tick.set(Date.now()),
    });

    this.loadActiveAll();
    this.api.balance().subscribe({ next: (b) => this.balance.set(b), error: () => {} });

    this.timerId = setInterval(() => this.tick.set(this.clock.nowMs()), 1000);

    this.socket.connect();

    this.socket
      .onAuctionCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => this.patchListWithIncoming(a));

    this.socket
      .onAuctionUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => {
        this.patchListWithIncoming(a);

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
            if (r.mode !== 'rolling' && r.mode !== 'none') this.roulette.set({ mode: 'none' });
          }
        }
      });

    this.socket
      .onAuctionDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        this.activeItems.set(this.activeItems().filter((x) => x.id !== p.id));
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
      .onAuctionMessageReaction()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ auctionId, messageId, reactions }) => {
        const id = this.openId();
        if (!id || auctionId !== id) return;

        const d = this.details();
        if (!d) return;

        const next = d.messages.map((m) => (m.id !== messageId ? m : { ...m, reactions }));
        this.details.set({ ...d, messages: next });
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
      this.tick();
      this.balance();
      this.activeGridApi?.refreshCells({ force: true });
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

  private ensurePager() {
    const api = this.activeGridApi;
    if (!api) return;

    try {
      api.setGridOption('pagination', true);
      api.setGridOption('paginationAutoPageSize', false);
      api.setGridOption('paginationPageSize', ACTIVE_PAGE_SIZE);
      api.paginationGoToFirstPage();
      api.refreshClientSideRowModel('sort');
    } catch {}
  }

  private loadActiveAll() {
    this.activeLoading.set(true);
    this.activeError.set(null);

    this.api.list().subscribe({
      next: (items) => {
        const arr = Array.isArray(items) ? items : [];
        this.activeItems.set(this.sortAuctions(arr));
        this.activeLoading.set(false);

        this.activeGridApi?.refreshCells({ force: true });
        this.ensurePager();
      },
      error: (e) => {
        this.activeLoading.set(false);
        this.activeError.set(e?.error?.message ?? this.transloco.translate('auctions.loadError'));
      },
    });
  }

  private patchListWithIncoming(a: AuctionCard) {
    const list = this.activeItems();
    const idx = list.findIndex((x) => x.id === a.id);

    let next: AuctionCard[];
    if (idx === -1) next = [a, ...list];
    else {
      next = list.slice();
      next[idx] = { ...next[idx], ...a };
    }

    this.activeItems.set(this.sortAuctions(next));
    this.activeGridApi?.refreshCells({ force: true });
    this.ensurePager();
  }

  private statusLabel(s: AuctionCard['status']) {
    const key =
      s === 'ACTIVE'
        ? 'auctions.statusActive'
        : s === 'FINALIZING'
          ? 'auctions.statusFinalizing'
          : s === 'TIE_COUNTDOWN'
            ? 'auctions.statusTieCountdown'
            : s === 'TIE_ROLLING'
              ? 'auctions.statusTieRolling'
              : s === 'FINISHED'
                ? 'auctions.statusFinished'
                : s === 'CANCELED'
                  ? 'auctions.statusCanceled'
                  : '';
    return key ? this.transloco.translate(key) : asStr(s);
  }

  private statusRank(s: AuctionCard['status']) {
    if (s === 'ACTIVE') return 10;
    if (s === 'FINALIZING') return 20;
    if (s === 'TIE_COUNTDOWN') return 30;
    if (s === 'TIE_ROLLING') return 40;
    if (s === 'FINISHED') return 90;
    if (s === 'CANCELED') return 99;
    return 50;
  }

  private remainingMsForSort(a: AuctionCard) {
    if (a.status === 'CANCELED') return Number.POSITIVE_INFINITY;
    const now = this.tick();
    const end = parseMs(a.endsAt);
    const start = parseMs(a.startsAt);
    const target = start > 0 && start > now ? start : end;
    if (!target) return Number.POSITIVE_INFINITY;
    return Math.max(0, target - now);
  }

  private sortAuctions(items: AuctionCard[]) {
    const arr = items.slice();
    arr.sort((a, b) => {
      const ra = this.statusRank(a.status);
      const rb = this.statusRank(b.status);
      if (ra !== rb) return ra - rb;

      const ta = this.remainingMsForSort(a);
      const tb = this.remainingMsForSort(b);
      if (ta !== tb) return ta - tb;

      return Number(a.id) - Number(b.id);
    });
    return arr;
  }

  onBackdropPointerDown(_e: PointerEvent) {
    this.pointerDownOnBackdrop = true;
  }

  onBackdropPointerUp(_e: PointerEvent) {
    if (this.pointerDownOnBackdrop) this.close();
    this.pointerDownOnBackdrop = false;
  }

  reload() {
    this.loadActiveAll();
    this.api.balance().subscribe({ next: (b) => this.balance.set(b), error: () => {} });
  }

  open(id: number) {
    this.isOpen.set(true);
    this.openId.set(id);
    this.bidError.set(null);
    this.chatError.set(null);
    this.chatFile.set(null);
    this.chatUploading.set(false);
    this.roulette.set({ mode: 'none' });

    this.api.details(id).subscribe({
      next: async (d) => {
        this.details.set(d);
        this.bidAmount.set(d.auction.currentBidAmount ?? 0);

        const ack = await this.socket.joinAuction(id);
        if (!ack.ok) this.chatError.set(ack.error ?? 'Falha ao entrar no leilão (socket)');

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

  close() {
    const id = this.openId();
    if (id) this.socket.leaveAuction(id).catch(() => {});

    this.isOpen.set(false);
    this.openId.set(null);
    this.details.set(null);
    this.bidAmount.set(0);
    this.bidError.set(null);
    this.chatText.set('');
    this.chatError.set(null);
    this.chatFile.set(null);
    this.chatUploading.set(false);
    this.roulette.set({ mode: 'none' });
    this.pointerDownOnBackdrop = false;
  }

  timeCaptionFor(a: AuctionCard) {
    if (a.status === 'CANCELED') return 'Cancelado:';
    if (a.status === 'FINISHED') return 'Finalizado:';
    const now = this.tick();
    const start = parseMs(a.startsAt);
    if (start > 0 && start > now) return 'Começa em:';
    return 'Termina em:';
  }

  timeCountdownFor(a: AuctionCard) {
    if (a.status === 'CANCELED') return fmtTimeLeft(0);
    if (a.status === 'FINISHED') return fmtTimeLeft(0);

    const now = this.tick();
    const start = parseMs(a.startsAt);
    const end = parseMs(a.endsAt);

    if (start > 0 && start > now) return fmtTimeLeft(start - now);
    return fmtTimeLeft(end - now);
  }

  modalTimeCaption() {
    const a = this.details()?.auction;
    if (!a) return this.transloco.translate('auctions.modalCaptionEnds');
    if (a.status === 'CANCELED') return this.transloco.translate('auctions.modalCaptionCanceled');
    if (a.status === 'FINISHED') return this.transloco.translate('auctions.modalCaptionFinished');

    const now = this.tick();
    const start = parseMs(a.startsAt);
    if (start > 0 && start > now) return this.transloco.translate('auctions.modalCaptionStarts');
    return this.transloco.translate('auctions.modalCaptionEnds');
  }

  modalTimeCountdown() {
    const a = this.details()?.auction;
    if (!a) return fmtTimeLeft(0);
    if (a.status === 'CANCELED') return fmtTimeLeft(0);
    if (a.status === 'FINISHED') return fmtTimeLeft(0);

    const now = this.tick();
    const start = parseMs(a.startsAt);
    const end = parseMs(a.endsAt);

    if (start > 0 && start > now) return fmtTimeLeft(start - now);
    return fmtTimeLeft(end - now);
  }

  chipsForCard(a: any): string[] {
    const fx = (a?.itemEffects ?? []) as any;
    if (!Array.isArray(fx)) return [];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of fx) {
      const t = String(s ?? '').trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }

  displayImage(a: AuctionCard) {
    return normalizeImgSrc((a as any).itemImagePath ?? null);
  }

  displayItemName(a: AuctionCard) {
    return asStr((a as any).itemName || '—');
  }

  brStartsAt(a: AuctionCard | null | undefined) {
    return this.formatDateTimeIso(a?.startsAt);
  }

  brEndsAt(a: AuctionCard | null | undefined) {
    return this.formatDateTimeIso(a?.endsAt);
  }

  shortTime(iso: string) {
    return this.formatTimeIso(iso);
  }

  private formatDateTimeIso(iso: string | null | undefined) {
    if (!iso) return '—';
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return '—';
    const d = new Date(ms);
    const lang = this.transloco.getActiveLang();
    const loc = lang === 'pt-BR' ? 'pt-BR' : lang === 'ru' ? 'ru-RU' : 'en-US';
    return new Intl.DateTimeFormat(loc, {
      timeZone: BR_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  private formatTimeIso(iso: string | null | undefined) {
    if (!iso) return '—';
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return '—';
    const d = new Date(ms);
    const lang = this.transloco.getActiveLang();
    const loc = lang === 'pt-BR' ? 'pt-BR' : lang === 'ru' ? 'ru-RU' : 'en-US';
    return new Intl.DateTimeFormat(loc, {
      timeZone: BR_TZ,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
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

    const cur = this.details();
    if (!cur) return;

    if (ack.auction) {
      this.details.set({ ...cur, auction: ack.auction });
      this.patchListWithIncoming(ack.auction);
    }

    const after = this.details();
    if (!after) return;

    this.details.set({
      ...after,
      myHold: amount,
      auction: {
        ...after.auction,
        tieCount: Number(after.auction.tieCount ?? 1) || 1,
      } as any,
    });
  }

  onChatFilePicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input?.files?.[0] ?? null;
    this.chatFile.set(f);
  }

  clearChatFile() {
    this.chatFile.set(null);
  }

  async sendChat() {
    this.chatError.set(null);

    const id = this.openId();
    if (!id) return;

    const text = this.chatText().trim();
    const file = this.chatFile();

    try {
      if (file) {
        this.chatUploading.set(true);

        this.api.chatUpload(id, file, text || null).subscribe({
          next: () => {
            this.chatText.set('');
            this.chatFile.set(null);
            this.chatUploading.set(false);
          },
          error: () => {
            this.chatUploading.set(false);
            this.chatError.set(this.transloco.translate('auctions.chatUploadFail'));
          },
        });

        return;
      }

      if (!text) return;

      const ack = await this.socket.chat(id, text);
      if (!ack.ok) {
        this.chatError.set(ack.error ?? this.transloco.translate('auctions.chatSendFail'));
        return;
      }

      this.chatText.set('');
    } catch {
      this.chatUploading.set(false);
      this.chatError.set(this.transloco.translate('auctions.chatSendFail'));
    }
  }

  private isStickerValue(v: string) {
    const s = asStr(v);
    return (
      s.startsWith('http://') ||
      s.startsWith('https://') ||
      s.startsWith('/uploads/') ||
      s.startsWith('data:')
    );
  }

  async toggleReaction(m: AuctionMessageDto, value: string) {
    const id = this.openId();
    if (!id) return;

    const messageId = Number(m.id);
    const v = asStr(value);
    if (!messageId || !v) return;

    const kind = this.isStickerValue(v) ? 'STICKER' : 'EMOJI';

    const ack = await this.socket.reactMessage(id, messageId, kind as any, v);
    if (!ack.ok) return;
  }

  normalizeImgSrc = normalizeImgSrc;

  quickReact(m: AuctionMessageDto, emoji: string) {
    this.toggleReaction(m, emoji);
  }

  async customReact(m: AuctionMessageDto) {
    const v = prompt(this.transloco.translate('auctions.promptReact')) ?? '';
    const s = asStr(v);
    if (!s) return;
    await this.toggleReaction(m, s);
  }

  messageAvatar(m: AuctionMessageDto) {
    return normalizeImgSrc(m.avatarUrl ?? null);
  }

  messageAttachments(m: AuctionMessageDto) {
    return Array.isArray(m.attachments) ? m.attachments : [];
  }

  messageReactions(m: AuctionMessageDto) {
    return Array.isArray(m.reactions) ? m.reactions : [];
  }

  reactionLabel(r: AuctionMessageReactionDto) {
    return r.kind === 'EMOJI' ? r.value : '🖼️';
  }

  reactionThumb(r: AuctionMessageReactionDto) {
    if (r.kind !== 'STICKER') return null;
    return normalizeImgSrc(r.value);
  }

  onRouletteFinished(ev: { winnerIndex: number; winnerName: string }) {
    const r = this.roulette();
    if (r.mode !== 'rolling') return;

    this.roulette.set({
      ...r,
      finishedName: ev.winnerName,
    });
  }

  private buildActiveTable(): DataTableConfig<AuctionCard> {
    const colDefs: ColDef<AuctionCard>[] = [
      {
        headerName: this.transloco.translate('auctions.colStatus'),
        width: 120,
        sortable: true,
        valueGetter: (p) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '';
          return this.statusRank(a.status);
        },
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '—';

          const label = this.escapeHtml(this.statusLabel(a.status));

          let border = 'rgba(148,163,184,.22)';
          let bg = 'rgba(2,6,23,.55)';
          let color = '#e2e8f0';

          if (a.status === 'ACTIVE') {
            border = 'rgba(16,185,129,.35)';
            bg = 'rgba(16,185,129,.12)';
            color = '#bbf7d0';
          } else if (a.status === 'FINALIZING') {
            border = 'rgba(245,158,11,.35)';
            bg = 'rgba(245,158,11,.12)';
            color = '#fde68a';
          } else if (a.status === 'TIE_COUNTDOWN' || a.status === 'TIE_ROLLING') {
            border = 'rgba(251,191,36,.35)';
            bg = 'rgba(251,191,36,.10)';
            color = '#fde68a';
          } else if (a.status === 'FINISHED') {
            border = 'rgba(148,163,184,.25)';
            bg = 'rgba(15,23,42,.35)';
            color = '#cbd5e1';
          } else if (a.status === 'CANCELED') {
            border = 'rgba(244,63,94,.35)';
            bg = 'rgba(244,63,94,.10)';
            color = '#fecdd3';
          }

          return `<span style="display:flex;align-items:center;height: 30px; padding:0px 16px;border-radius:999px;border:1px solid ${border};background:${bg};font-size:11px;font-weight:800;color:${color}">${label}</span>`;
        },
      },
      {
        headerName: this.transloco.translate('auctions.colItem'),
        width: 110,
        sortable: false,
        filter: false,
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '';
          const img = this.displayImage(a) || '/assets/images/placeholder.png';

          return `
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div style="width:56px;height:56px;border-radius:12px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.55);display:flex;align-items:center;justify-content:center">
                <img src="${this.escapeAttr(img)}" style="width:100%;height:100%;object-fit:contain;display:block" alt=""/>
              </div>
            </div>
          `;
        },
      },
      {
        headerName: this.transloco.translate('auctions.colItem'),
        width: 360,
        sortable: false,
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '';
          const name = this.escapeHtml(this.displayItemName(a));

          return `
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div style="min-width:0">
                <div style="font-weight:800;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${name}">${name}</div>
              </div>
            </div>
          `;
        },
      },
      {
        headerName: this.transloco.translate('auctions.colTime'),
        width: 220,
        sortable: true,
        valueGetter: (p) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return Number.POSITIVE_INFINITY;
          return this.remainingMsForSort(a);
        },
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '';
          const cap = this.escapeHtml(this.timeCaptionFor(a));
          const left = this.escapeHtml(this.timeCountdownFor(a));
          return `<div style="font-weight:800;color:#e2e8f0">${cap} <span style="color:#e2e8f0">${left}</span></div>`;
        },
      },
      {
        headerName: this.transloco.translate('auctions.colLeading'),
        width: 200,
        sortable: false,
        valueGetter: (p) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '';
          return asStr((a as any).lastBidNickname ?? '');
        },
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '';
          if ((a as any).lastBidNickname) {
            const nick = asStr((a as any).lastBidNickname);
            const amt = Number((a as any).currentBidAmount ?? 0);
            const txt = this.transloco.translate('auctions.leadingBid', { nick, amt: String(amt) });
            return `<span style="color:rgba(148,163,184,.9)">${this.escapeHtml(txt)}</span>`;
          }
          return `<span style="color:rgba(148,163,184,.9)">${this.escapeHtml(this.transloco.translate('auctions.noBids'))}</span>`;
        },
      },
      {
        headerName: this.transloco.translate('auctions.colStart'),
        width: 170,
        sortable: true,
        valueGetter: (p) => {
          const a = p.data as AuctionCard | undefined;
          return a?.startsAt ?? '';
        },
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '—';
          return `<span style="color:rgba(148,163,184,.9)"><b style="color:#e2e8f0">${this.escapeHtml(
            this.brStartsAt(a),
          )}</b></span>`;
        },
      },
      {
        headerName: this.transloco.translate('auctions.colEnd'),
        width: 170,
        flex: 1,
        sortable: true,
        valueGetter: (p) => {
          const a = p.data as AuctionCard | undefined;
          return a?.endsAt ?? '';
        },
        cellRenderer: (p: any) => {
          const a = p.data as AuctionCard | undefined;
          if (!a) return '—';
          return `<span style="color:rgba(148,163,184,.9)"><b style="color:#e2e8f0">${this.escapeHtml(
            this.brEndsAt(a),
          )}</b></span>`;
        },
      },
    ];

    return {
      id: 'auctions-active',
      colDefs,
      rowHeight: 70,
      quickFilterPlaceholder: this.transloco.translate('common.search'),
      pagination: { enabled: false, autoPageSize: true, pageSize: 60 },
      gridOptions: {
        onGridReady: (e: GridReadyEvent<AuctionCard>) => {
          this.activeGridApi = e.api;
          this.ensurePager();
        },
        onRowClicked: (e: any) => {
          const a = e?.data as AuctionCard | undefined;
          if (!a) return;
          this.open(Number(a.id));
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

  private escapeAttr(s: string) {
    return this.escapeHtml(s).replaceAll('`', '&#096;');
  }
}
