// src/app/api/auctions.api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type AuctionStatus =
  | 'ACTIVE'
  | 'FINALIZING'
  | 'TIE_COUNTDOWN'
  | 'TIE_ROLLING'
  | 'FINISHED'
  | 'CANCELED';

// ✅ chips prontos
export type AuctionEffect = string;

export type AuctionCard = {
  id: number;
  title: string;

  itemType: string;
  itemId: number | null;
  itemName: string;
  itemImagePath: string | null;

  startsAt: string;
  endsAt: string;
  status: AuctionStatus;

  currentBidAmount: number;
  tieCount: number;

  itemEffects: AuctionEffect[] | null; // ✅ string[] | null

  lastBidUserId: number | null;
  lastBidNickname: string | null;
  lastBidAt: string | null;

  winnerUserId: number | null;
  winnerNickname: string | null;
  winningBidAmount: number | null;

  isCanceled: boolean;
  canceledAt: string | null;
  cancelReason: string | null;

  createdAt: string;
};

export type AuctionMessageType = 'CHAT' | 'BID' | 'SYSTEM';

export type AuctionAttachmentKind = 'IMAGE' | 'GIF' | 'STICKER';

export type AuctionMessageAttachment = {
  kind: AuctionAttachmentKind;
  url: string;
  mime?: string | null;
  name?: string | null;
  size?: number | null;
};

export type AuctionReactionKind = 'EMOJI' | 'STICKER';

export type AuctionMessageReactionDto = {
  kind: AuctionReactionKind;
  value: string;
  count: number;
  me: boolean;
};

export type AuctionMessageDto = {
  id: number;
  type: AuctionMessageType;
  userId: number | null;
  nickname: string | null;

  avatarUrl?: string | null;

  text: string | null;
  bidAmount: number | null;

  attachments?: AuctionMessageAttachment[] | null;
  reactions?: AuctionMessageReactionDto[];

  createdAt: string;
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

  // ✅ se você usa separado no modal, mantém o mesmo snapshot
  itemEffects: AuctionEffect[] | null;

  balance: UserBalanceDto;
  tie: AuctionTieInfo | null;
  roulette: AuctionRouletteInfo | null;
};

export type CreateAuctionDto = {
  title: string;
  itemType: string;
  itemId?: number | null;
  itemName: string;

  // ✅ chips prontos
  itemEffects?: string[] | null;

  itemImagePath?: string | null;
  durationSeconds: number;
  startsAt?: string;
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

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

@Injectable({ providedIn: 'root' })
export class AuctionsApi {
  private http = inject(HttpClient);

  time() {
    return this.http.get<ServerTimeDto>(`${API_BASE}/auctions/time`);
  }

  list() {
    return this.http.get<AuctionCard[]>(`${API_BASE}/auctions`);
  }

  listPage(params: { group: 'active' | 'finished'; page: number; pageSize: number }) {
    const httpParams = new HttpParams()
      .set('group', params.group)
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    return this.http.get<PagedResult<AuctionCard>>(`${API_BASE}/auctions/page`, { params: httpParams });
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

  chatUpload(id: number, file: File, caption?: string | null) {
    const fd = new FormData();
    fd.append('file', file);
    if (caption != null) fd.append('caption', String(caption));
    return this.http.post<{ message: AuctionMessageDto }>(`${API_BASE}/auctions/${id}/chat/upload`, fd);
  }

  adminList() {
    return this.http.get<AuctionCard[]>(`${API_BASE}/auctions/admin/list`);
  }

  adminListPage(params: { group: 'all' | 'active' | 'finished'; page: number; pageSize: number }) {
    const httpParams = new HttpParams()
      .set('group', params.group)
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    return this.http.get<PagedResult<AuctionCard>>(`${API_BASE}/auctions/admin/page`, { params: httpParams });
  }

  create(dto: CreateAuctionDto) {
    return this.http.post<AuctionCard>(`${API_BASE}/auctions`, dto);
  }

  update(id: number, dto: UpdateAuctionDto) {
    return this.http.patch<AuctionCard>(`${API_BASE}/auctions/${id}`, dto);
  }

  cancel(id: number, reason: string | null) {
    return this.http.patch<any>(`${API_BASE}/auctions/${id}/cancel`, { reason: reason ?? null });
  }

  hardDelete(id: number) {
    return this.http.delete<any>(`${API_BASE}/auctions/${id}`);
  }
}
