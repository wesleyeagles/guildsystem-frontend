// src/app/services/auctions-socket.service.ts
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

import { io, type Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';

import type { AuctionCard, AuctionMessageDto, UserBalanceDto } from '../api/auctions.api';
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

@Injectable({ providedIn: 'root' })
export class AuctionsSocketService {
  private auth = inject(AuthService);

  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);

  // ✅ guarda qual token foi usado pra abrir esse socket
  private tokenInUse: string | null = null;

  // Global stream (any auction)
  private auctionCreated$ = new Subject<AuctionCard>();
  private auctionUpdated$ = new Subject<AuctionCard>();
  private auctionDeleted$ = new Subject<WsAuctionDeleted>();

  // Per-auction streams
  private auctionMessage$ = new Subject<{ auctionId: number; message: AuctionMessageDto }>();
  private rouletteStart$ = new Subject<{ auctionId: number; payload: RouletteStartPayload }>();
  private auctionFinished$ = new Subject<{ auctionId: number; payload: any }>();

  // Per-user stream
  private userBalance$ = new Subject<UserBalanceDto>();

  isConnected() {
    return this.connected$.asObservable();
  }

  onAuctionCreated() { return this.auctionCreated$.asObservable(); }
  onAuctionUpdated() { return this.auctionUpdated$.asObservable(); }
  onAuctionDeleted() { return this.auctionDeleted$.asObservable(); }
  onAuctionMessage() { return this.auctionMessage$.asObservable(); }
  onRouletteStart() { return this.rouletteStart$.asObservable(); }
  onAuctionFinished() { return this.auctionFinished$.asObservable(); }
  onUserBalance() { return this.userBalance$.asObservable(); }

  connect() {
    const token = this.auth.accessToken();
    if (!token) return;

    // ✅ se já existe socket mas token mudou, recria (sem F5)
    if (this.socket && this.tokenInUse && this.tokenInUse !== token) {
      this.disconnect();
    }

    // ✅ se socket existe e tá ok, só garante conectado
    if (this.socket) {
      if (this.socket.disconnected) this.socket.connect();
      return;
    }

    const url = environment.apiUrl.replace(/\/$/, '');
    this.tokenInUse = token;

    this.socket = io(`${url}/auctions`, {
      transports: ['websocket'],
      auth: { token },
      withCredentials: true,
      // ✅ evita ficar preso em reconexões infinitas quando token ruim
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 400,
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
    this.socket.disconnect();
    this.socket = null;
    this.tokenInUse = null; // ✅ limpa token
    this.connected$.next(false);
  }

  joinAuction(auctionId: number) {
    this.ensureConnected();
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      this.socket!.emit('joinAuction', { auctionId }, (ack: any) => resolve(ack ?? { ok: true }));
    });
  }

  leaveAuction(auctionId: number) {
    if (!this.socket) return Promise.resolve({ ok: true });
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      this.socket!.emit('leaveAuction', { auctionId }, (ack: any) => resolve(ack ?? { ok: true }));
    });
  }

  bid(auctionId: number, amount: number) {
    this.ensureConnected();
    return new Promise<{ ok: boolean; error?: string; auction?: AuctionCard }>((resolve) => {
      this.socket!.emit('bid', { auctionId, amount }, (ack: any) => resolve(ack ?? { ok: true }));
    });
  }

  chat(auctionId: number, text: string) {
    this.ensureConnected();
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      this.socket!.emit('chat', { auctionId, text }, (ack: any) => resolve(ack ?? { ok: true }));
    });
  }

  private ensureConnected() {
    // ✅ sempre garante que o socket é do token atual
    const token = this.auth.accessToken();
    if (!token) throw new Error('Sem token');

    // se socket existe mas token mudou, recria
    if (this.socket && this.tokenInUse && this.tokenInUse !== token) {
      this.disconnect();
    }

    if (!this.socket) this.connect();
    if (!this.socket) throw new Error('Socket não inicializado (sem token)');
    if (this.socket.disconnected) this.socket.connect();
  }

  private normalizeMessage(m: any): AuctionMessageDto {
    return {
      id: Number(m?.id ?? 0),
      type: (m?.type ?? 'CHAT') as any,
      userId: m?.userId ?? null,
      nickname: m?.nickname ?? null,
      text: m?.text ?? null,
      bidAmount: m?.bidAmount ?? null,
      createdAt: String(m?.createdAt ?? new Date().toISOString()),
    };
  }
}
