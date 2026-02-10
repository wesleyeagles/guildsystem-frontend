import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type EventLogItemDto = {
  claimId: number;

  event: {
    id: number;
    title: string | null;
    points: number;
    createdByUserId: number;
    createdByNickname: string | null;
  };

  claimedBy: {
    userId: number;
    nickname: string | null;
  };

  claimedAt: string;
  reversedAt: string | null;
  reversedByUserId: number | null;
  reverseReason: string | null;
};

export type EventLogsResponseDto = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: EventLogItemDto[];
};

export type ReverseClaimDto = {
  reason?: string;
};

export type ReverseClaimResponseDto = {
  ok: boolean;
  claimId: number;
  eventId: number;
  userId: number;
  pointsReverted: number;
  reversedAt: string; // ISO
  alreadyReversed: boolean;
};

@Injectable({ providedIn: 'root' })
export class LogsApi {
  private http = inject(HttpClient);

  private baseUrl = `${environment.apiUrl}/events`;

  getLogs(params?: {
    page?: number;
    pageSize?: number;
    q?: string;
  }): Observable<EventLogsResponseDto> {
    let httpParams = new HttpParams();

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const q = params?.q?.trim();

    httpParams = httpParams.set('page', String(page));
    httpParams = httpParams.set('pageSize', String(pageSize));
    if (q) httpParams = httpParams.set('q', q);

    return this.http.get<EventLogsResponseDto>(`${this.baseUrl}/logs`, {
      params: httpParams,
      withCredentials: true,
    });
  }

  reverseClaim(claimId: number, dto: ReverseClaimDto = {}): Observable<ReverseClaimResponseDto> {
    return this.http.patch<ReverseClaimResponseDto>(
      `${this.baseUrl}/logs/${claimId}/reverse`,
      dto,
      { withCredentials: true },
    );
  }
}
