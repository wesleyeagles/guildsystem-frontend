import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type AuctionStatus =
  | 'ACTIVE'
  | 'FINALIZING'
  | 'TIE_COUNTDOWN'
  | 'TIE_ROLLING'
  | 'FINISHED'
  | 'CANCELED';

export type AuctionCard = {
  id: number;
  title: string;

  itemType: string;
  itemId: number | null;
  itemName: string;
  itemImagePath: string | null;

  startsAt: string; // ISO
  endsAt: string; // ISO
  status: AuctionStatus;

  currentBidAmount: number;
  tieCount: number;

  lastBidUserId: number | null;
  lastBidNickname: string | null;
  lastBidAt: string | null;

  winnerUserId: number | null;
  winnerNickname: string | null;
  winningBidAmount: number | null;

  isCanceled: boolean;
  canceledAt: string | null;
  cancelReason: string | null;

  createdAt: string; // ISO
};

export type AuctionMessageType = 'CHAT' | 'BID' | 'SYSTEM';

export type AuctionMessageDto = {
  id: number;
  type: AuctionMessageType;
  userId: number | null;
  nickname: string | null;
  text: string | null;
  bidAmount: number | null;
  createdAt: string; // ISO
};

export type UserBalanceDto = {
  points: number;
  reserved: number;
  available: number;
};

export type AuctionTieInfo = {
  endsAt: string | null;
  participants: { userId: number; nickname: string }[];
};

export type AuctionRouletteInfo = {
  seed: string | null;
  endsAt: string | null;
};

export type AuctionDetailsDto = {
  auction: AuctionCard;
  messages: AuctionMessageDto[];
  myHold: number;
  balance: UserBalanceDto;
  tie: AuctionTieInfo | null;
  roulette: AuctionRouletteInfo | null;
};

export type CreateAuctionDto = {
  title: string;
  itemType: string;
  itemId?: number | null;
  itemName: string;
  itemImagePath?: string | null;
  durationSeconds: number;
  startsAt?: string; // ISO
};

export type UpdateAuctionDto = {
  title?: string;
  itemType?: string;
  itemId?: number | null;
  itemName?: string;
  itemImagePath?: string | null;
  extendSeconds?: number;
};

export type ServerTimeDto = {
  serverTimeMs: number;
  serverNow: string;
};

@Injectable({ providedIn: 'root' })
export class AuctionsApi {
  private http = inject(HttpClient);

  // ✅ Clock sync
  time() {
    return this.http.get<ServerTimeDto>(`${API_BASE}/auctions/time`);
  }

  // ===== User/Public =====

  list() {
    return this.http.get<AuctionCard[]>(`${API_BASE}/auctions`);
  }

  details(id: number) {
    return this.http.get<AuctionDetailsDto>(`${API_BASE}/auctions/${id}`);
  }

  balance() {
    return this.http.get<UserBalanceDto>(`${API_BASE}/auctions/me/balance`);
  }

  bid(id: number, amount: number) {
    return this.http.post<any>(`${API_BASE}/auctions/${id}/bid`, { amount });
  }

  chat(id: number, text: string) {
    return this.http.post<any>(`${API_BASE}/auctions/${id}/chat`, { text });
  }

  // ===== Admin =====

  adminList() {
    return this.http.get<AuctionCard[]>(`${API_BASE}/auctions/admin/list`);
  }

  create(dto: CreateAuctionDto) {
    return this.http.post<AuctionCard>(`${API_BASE}/auctions`, dto);
  }

  update(id: number, dto: UpdateAuctionDto) {
    return this.http.patch<AuctionCard>(`${API_BASE}/auctions/${id}`, dto);
  }

  cancel(id: number, reason: string | null) {
    return this.http.patch<any>(`${API_BASE}/auctions/${id}/cancel`, {
      reason: reason ?? null,
    });
  }

  hardDelete(id: number) {
    return this.http.delete<any>(`${API_BASE}/auctions/${id}`);
  }
}
