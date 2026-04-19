import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type EventCategory = 'CW' | 'GENERIC';

export type EventDefinition = {
  id: number;
  code: string;
  title: string;
  points: number;
  category: EventCategory;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ActiveEvent = {
  id: number;
  title: string;
  points: number;
  expiresAt: string;
  isDoubled?: boolean;
  pilotBonusPoints?: number;
};

export type EventInstance = {
  id: number;
  title: string;
  points: number;
  expiresAt: string;

  definitionCode?: string;
  basePoints?: number;
  isDoubled?: boolean;
  category?: EventCategory;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: number;

  isCanceled?: boolean;
  canceledAt?: string | null;
  cancelReason?: string | null;
  canceledByUserId?: number | null;

  pilotBonusPoints?: number;

  claimedByMe?: boolean;
  claimedAt?: string | null;
  claimReversedAt?: string | null;

  claimStatus?: 'APPROVED' | 'PENDING' | 'REJECTED' | null;
  claimHasPilot?: boolean;
};

export type PendingPilotClaimItem = {
  claimId: number;
  createdAt: string;
  pilotImagePath: string | null;
  event: {
    id: number;
    title: string | null;
    points: number;
    pilotBonusPoints: number;
  };
  user: {
    userId: number;
    nickname: string | null;
  };
};

export type PendingPilotClaimsResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: PendingPilotClaimItem[];
};

// ✅ NOVO: claims público (todos usuários)
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PublicClaimItem = {
  claimId: number;
  status: ClaimStatus;
  hasPilot: boolean;
  pilotImagePath: string | null;
  pointsGranted: number | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  event: {
    id: number;
    title: string | null;
    points: number;
    pilotBonusPoints: number;
  };
  user: {
    userId: number;
    nickname: string | null;
  };
};

export type PublicClaimsResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: PublicClaimItem[];
};

export type EventsListPage = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: EventInstance[];
};

@Injectable({ providedIn: 'root' })
export class EventsApi {
  private http = inject(HttpClient);

  definitions() {
    return this.http.get<EventDefinition[]>(`${API_BASE}/events/definitions`);
  }

  createDefinition(payload: {
    code: string;
    title: string;
    points: number;
    category?: EventCategory;
    isActive?: boolean;
  }) {
    return this.http.post<EventDefinition>(`${API_BASE}/events/definitions`, payload);
  }

  updateDefinition(
    id: number,
    payload: {
      title?: string;
      points?: number;
      category?: EventCategory;
      isActive?: boolean;
    },
  ) {
    return this.http.patch<EventDefinition>(`${API_BASE}/events/definitions/${id}`, payload);
  }

  deleteDefinition(id: number) {
    return this.http.delete<{ ok: boolean }>(`${API_BASE}/events/definitions/${id}`);
  }

  active() {
    return this.http.get<ActiveEvent[]>(`${API_BASE}/events/active`);
  }

  create(payload: {
    definitionCode: string;
    password: string;
    durationMinutes: 5 | 10 | 15 | 30 | 45 | 60;
    isDoubled?: boolean;
    pilotBonusPoints?: number;
  }) {
    return this.http.post<{ id: number; title: string; points: number; expiresAt: string; isDoubled?: boolean }>(
      `${API_BASE}/events`,
      payload,
    );
  }

  listAdminPage(params: { page: number; pageSize: number }) {
    const p = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    return this.http.get<EventsListPage>(`${API_BASE}/events/admin`, { params: p });
  }

  /** Todas as páginas (admin); evita alterar consumidores que esperam um array completo. */
  listAdmin(): Observable<EventInstance[]> {
    const pageSize = 150;
    const step = (page: number): Observable<EventInstance[]> =>
      this.listAdminPage({ page, pageSize }).pipe(
        mergeMap((res) => {
          const batch = res.items ?? [];
          if (res.page >= res.totalPages || batch.length === 0) {
            return of(batch);
          }
          return step(page + 1).pipe(map((rest) => [...batch, ...rest]));
        }),
      );
    return step(1);
  }

  listAllPage(params: { page: number; pageSize: number }) {
    const p = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    return this.http.get<EventsListPage>(`${API_BASE}/events`, { params: p });
  }

  /** Todas as páginas (usuário). */
  listAll(): Observable<EventInstance[]> {
    const pageSize = 150;
    const step = (page: number): Observable<EventInstance[]> =>
      this.listAllPage({ page, pageSize }).pipe(
        mergeMap((res) => {
          const batch = res.items ?? [];
          if (res.page >= res.totalPages || batch.length === 0) {
            return of(batch);
          }
          return step(page + 1).pipe(map((rest) => [...batch, ...rest]));
        }),
      );
    return step(1);
  }

  claim(id: number, password: string) {
    return this.http.post<{ ok: boolean; pointsAdded: number; eventId: number }>(`${API_BASE}/events/${id}/claim`, {
      password,
    });
  }

  claimPilot(id: number, password: string, image: File) {
    const fd = new FormData();
    fd.append('password', password);
    fd.append('hasPilot', 'true');
    fd.append('image', image);

    return this.http.post<{ ok: boolean; pending: boolean; pointsAdded: number; eventId: number }>(
      `${API_BASE}/events/${id}/claim-pilot`,
      fd,
    );
  }

  cancel(id: number, reason?: string | null) {
    return this.http.patch(`${API_BASE}/events/${id}/cancel`, { reason: reason ?? null });
  }

  pendingPilotClaims(params: { page: number; pageSize: number; q?: string }) {
    const p = new URLSearchParams();
    p.set('page', String(params.page));
    p.set('pageSize', String(params.pageSize));
    if (params.q) p.set('q', params.q);

    return this.http.get<PendingPilotClaimsResponse>(`${API_BASE}/events/pending-claims?${p.toString()}`);
  }

  approvePilotClaim(claimId: number) {
    return this.http.patch<{ ok: boolean; claimId: number; pointsAdded?: number }>(
      `${API_BASE}/events/pending-claims/${claimId}/approve`,
      {},
    );
  }

  rejectPilotClaim(claimId: number, reason: string | null) {
    return this.http.patch<{ ok: boolean; claimId: number; reason?: string }>(
      `${API_BASE}/events/pending-claims/${claimId}/reject`,
      { reason },
    );
  }

  claimsPublic(params: { page: number; pageSize: number; q?: string; status?: ClaimStatus | 'ALL' }) {
    const p = new URLSearchParams();
    p.set('page', String(params.page));
    p.set('pageSize', String(params.pageSize));
    if (params.q) p.set('q', params.q);
    if (params.status && params.status !== 'ALL') p.set('status', params.status);

    return this.http.get<PublicClaimsResponse>(`${API_BASE}/events/claims?${p.toString()}`);
  }
}
