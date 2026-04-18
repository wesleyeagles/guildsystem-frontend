import { Injectable, effect, inject } from '@angular/core';
import { environment } from '../../environments/environment';

import { io, type Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';

import type {
  AuctionCard,
  AuctionMessageDto,
  AuctionMessageReactionDto,
  UserBalanceDto,
} from '../api/auctions.api';
import { AuthService } from '../auth/auth.service';

export type RouletteStartPayload = {
  auctionId: number;
  seed: string;
  durationMs: number;
  winnerIndex: number;
  amount: number;
  participants: { userId: number; nickname: string }[];
};

type WsAuctionDeleted = { id: number };

function asStr(v: any) {
  return String(v ?? '').trim();
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);

    p.then((v) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(v);
    }).catch(() => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resolve(fallback);
    });
  });
}

@Injectable({ providedIn: 'root' })
export class AuctionsSocketService {
  private auth = inject(AuthService);

  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);

  // token atual em uso (pra detectar troca sem F5)
  private tokenInUse: string | null = null;

  // Global stream (any auction)
  private auctionCreated$ = new Subject<AuctionCard>();
  private auctionUpdated$ = new Subject<AuctionCard>();
  private auctionDeleted$ = new Subject<WsAuctionDeleted>();

  // Per-auction streams
  private auctionMessage$ = new Subject<{ auctionId: number; message: AuctionMessageDto }>();
  private auctionMessageReaction$ = new Subject<{
    auctionId: number;
    messageId: number;
    reactions: AuctionMessageReactionDto[];
  }>();
  private rouletteStart$ = new Subject<{ auctionId: number; payload: RouletteStartPayload }>();
  private auctionFinished$ = new Subject<{ auctionId: number; payload: any }>();

  // Per-user stream
  private userBalance$ = new Subject<UserBalanceDto>();

  constructor() {
    // ✅ auto-conecta quando o token aparecer / muda
    effect(() => {
      const token = this.auth.accessToken();
      const t = asStr(token);
      if (!t) {
        // sem token => garante que não fica socket “zumbi”
        this.disconnect();
        return;
      }

      // token mudou => recria socket
      if (this.socket && this.tokenInUse && this.tokenInUse !== t) {
        this.disconnect();
      }

      // se não existe socket, cria
      if (!this.socket) {
        this.connect();
        return;
      }

      // garante auth atualizado no handshake
      this.socket.auth = { token: t };

      // se caiu, tenta reconectar
      if (this.socket.disconnected) {
        try {
          this.socket.connect();
        } catch {
          // ignore
        }
      }
    });
  }

  isConnected() {
    return this.connected$.asObservable();
  }

  onAuctionCreated() {
    return this.auctionCreated$.asObservable();
  }
  onAuctionUpdated() {
    return this.auctionUpdated$.asObservable();
  }
  onAuctionDeleted() {
    return this.auctionDeleted$.asObservable();
  }

  onAuctionMessage() {
    return this.auctionMessage$.asObservable();
  }
  onAuctionMessageReaction() {
    return this.auctionMessageReaction$.asObservable();
  }

  onRouletteStart() {
    return this.rouletteStart$.asObservable();
  }
  onAuctionFinished() {
    return this.auctionFinished$.asObservable();
  }
  onUserBalance() {
    return this.userBalance$.asObservable();
  }

  connect() {
    const token = asStr(this.auth.accessToken());
    if (!token) return;

    // se já existe socket e token não mudou, só garante connect
    if (this.socket) {
      if (this.socket.disconnected) {
        try {
          this.socket.connect();
        } catch {
          // ignore
        }
      }
      return;
    }

    const url = environment.apiUrl.replace(/\/$/, '');
    this.tokenInUse = token;

    this.socket = io(`${url}/auctions`, {
      transports: ['websocket'],
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2500,
      timeout: 8000,
    });

    this.socket.on('connect', () => this.connected$.next(true));
    this.socket.on('disconnect', () => this.connected$.next(false));
    this.socket.on('connect_error', () => this.connected$.next(false));

    // === Global auction events ===
    this.socket.on('auctionCreated', (payload: AuctionCard) => this.auctionCreated$.next(payload));
    this.socket.on('auctionUpdated', (payload: AuctionCard) => this.auctionUpdated$.next(payload));
    this.socket.on('auctionDeleted', (payload: WsAuctionDeleted) => this.auctionDeleted$.next(payload));

    // === Per-auction events ===
    this.socket.on('auctionMessage', (payload: any) => {
      const auctionId = Number(payload?.auctionId ?? 0);
      if (!auctionId) return;

      const message = this.normalizeMessage(payload);
      this.auctionMessage$.next({ auctionId, message });
    });

    this.socket.on('auctionMessageReaction', (payload: any) => {
      const auctionId = Number(payload?.auctionId ?? 0);
      const messageId = Number(payload?.messageId ?? 0);
      if (!auctionId || !messageId) return;

      const reactions = Array.isArray(payload?.reactions) ? payload.reactions : [];
      this.auctionMessageReaction$.next({ auctionId, messageId, reactions });
    });

    this.socket.on('rouletteStart', (payload: any) => {
      const auctionId = Number(payload?.auctionId ?? 0);
      if (!auctionId) return;

      const p: RouletteStartPayload = {
        auctionId,
        seed: String(payload?.seed ?? ''),
        durationMs: Number(payload?.durationMs ?? 9000),
        winnerIndex: Number(payload?.winnerIndex ?? 0),
        amount: Number(payload?.amount ?? 0),
        participants: Array.isArray(payload?.participants) ? payload.participants : [],
      };

      this.rouletteStart$.next({ auctionId, payload: p });
    });

    this.socket.on('auctionFinished', (payload: any) => {
      const auctionId = Number(payload?.auctionId ?? 0);
      if (!auctionId) return;
      this.auctionFinished$.next({ auctionId, payload });
    });

    // === Per-user events ===
    this.socket.on('userBalance', (payload: UserBalanceDto) => {
      this.userBalance$.next(payload);
    });
  }

  disconnect() {
    if (!this.socket) return;
    try {
      this.socket.removeAllListeners();
    } catch {
      // ignore
    }
    try {
      this.socket.disconnect();
    } catch {
      // ignore
    }
    this.socket = null;
    this.tokenInUse = null;
    this.connected$.next(false);
  }

  // =====================
  // ACK helpers (NUNCA trava)
  // =====================
  private ensureConnectedSafe(): { ok: boolean; error?: string } {
    const token = asStr(this.auth.accessToken());
    if (!token) return { ok: false, error: 'Sem token (sessão não inicializada ou expirada)' };

    if (this.socket && this.tokenInUse && this.tokenInUse !== token) {
      this.disconnect();
    }

    if (!this.socket) this.connect();
    if (!this.socket) return { ok: false, error: 'Socket não inicializado' };

    this.socket.auth = { token };

    if (this.socket.disconnected) {
      try {
        this.socket.connect();
      } catch {
        // ignore
      }
    }

    return { ok: true };
  }

  private emitAck<TAck extends { ok: boolean; error?: string }>(
    event: string,
    payload: any,
    timeoutMs: number,
    fallbackError: string,
  ): Promise<TAck> {
    const st = this.ensureConnectedSafe();
    if (!st.ok) return Promise.resolve({ ok: false, error: st.error } as TAck);

    const s = this.socket!;
    const p = new Promise<TAck>((resolve) => {
      try {
        s.emit(event, payload, (ack: any) => {
          if (!ack || typeof ack.ok !== 'boolean') {
            resolve({ ok: true } as TAck);
            return;
          }
          resolve(ack as TAck);
        });
      } catch {
        resolve({ ok: false, error: fallbackError } as TAck);
      }
    });

    return withTimeout<TAck>(p, timeoutMs, { ok: false, error: 'Socket timeout (ack não recebido)' } as TAck);
  }

  joinAuction(auctionId: number) {
    return this.emitAck<{ ok: boolean; error?: string }>(
      'joinAuction',
      { auctionId },
      2500,
      'Falha ao entrar no leilão (socket)',
    );
  }

  leaveAuction(auctionId: number) {
    // timeout menor e “safe” (close não pode travar)
    return this.emitAck<{ ok: boolean; error?: string }>(
      'leaveAuction',
      { auctionId },
      1200,
      'Falha ao sair do leilão (socket)',
    );
  }

  bid(auctionId: number, amount: number) {
    return this.emitAck<{ ok: boolean; error?: string; auction?: AuctionCard }>(
      'bid',
      { auctionId, amount },
      4000,
      'Falha ao dar lance (socket)',
    );
  }

  chat(auctionId: number, text: string) {
    return this.emitAck<{ ok: boolean; error?: string }>(
      'chat',
      { auctionId, text },
      3000,
      'Falha no chat (socket)',
    );
  }

  reactMessage(
    auctionId: number,
    messageId: number,
    kind: 'EMOJI' | 'STICKER',
    value: string,
  ) {
    return this.emitAck<{ ok: boolean; error?: string; reactions?: any[] }>(
      'reactMessage',
      { auctionId, messageId, kind, value },
      3000,
      'Falha ao reagir (socket)',
    );
  }

  syncTime(clientTimeMs: number, seq: number) {
    return this.emitAck<any>(
      'syncTime',
      { clientTimeMs, seq },
      2000,
      'Falha ao sincronizar relógio (socket)',
    );
  }

  private normalizeMessage(m: any): AuctionMessageDto {
    return {
      id: Number(m?.id ?? 0),
      type: (m?.type ?? 'CHAT') as any,
      userId: m?.userId ?? null,
      nickname: m?.nickname ?? null,
      avatarUrl: m?.avatarUrl ?? null,
      text: m?.text ?? null,
      bidAmount: m?.bidAmount ?? null,
      attachments: m?.attachments ?? null,
      reactions: Array.isArray(m?.reactions) ? m.reactions : [],
      createdAt: String(m?.createdAt ?? new Date().toISOString()),
    };
  }
}
