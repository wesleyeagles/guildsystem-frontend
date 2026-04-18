import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type Roles = 'none' | 'readonly' | 'moderator' | 'admin' | 'root';

export type LeaderboardRow = {
  userId: number;
  nickname: string;
  points: number;
  lastEventAt: string | null;
  lastEventTitle: string | null;
  lastEventDefinitionCode: string | null;
  discordId: string | null;
  discordAvatar: string | null;
  discordDiscriminator: string | null;
};

export type SafeUser = {
  id: number;
  email: string;
  scope: Roles;
  nickname: string;
  points: number;
  accepted: boolean;
  hasConfirmedSiteNickname: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;

  discordId: string | null;
  discordUsername: string | null;
  discordDiscriminator: string | null;
  discordAvatar: string | null;
  discordLinkedAt: string | null;
};

export type PublicUserProfile = {
  user: SafeUser;
  stats: {
    totalRegistered: number;
    totalSpent: number;
    warnings: number;
    lastLoginAt: string | null;
  };
};

export type UserEventHistoryRow = {
  claimId: number;
  eventId: number;
  title: string;
  definitionCode: string | null;

  pointsBase: number;
  bonusPilot: number;
  pointsGranted: number;

  mult: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  hasPilot: boolean;

  createdAt: string;
  addBy: string | null;

  reversedAt: string | null;
  reverseReason: string | null;
};

export type UserEventHistoryPaged = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: UserEventHistoryRow[];
};

export type AdminManualClaimDto = {
  title: string;
  points: number;
  reason?: string | null;
};

export type AdjustPointsDto = {
  delta: number;
  title?: string | null;
  reason?: string | null;
};

export type PointsLogKind =
  | 'EVENT_CLAIM'
  | 'EVENT_PILOT_APPROVE'
  | 'EVENT_PILOT_REJECT_BASE'
  | 'EVENT_REVERSE'
  | 'EVENT_CANCEL'
  | 'ADMIN_ADJUST'
  | 'MANUAL_CLAIM'
  | 'SYSTEM';

export type PointsHistoryRow = {
  id: number;
  kind: PointsLogKind;
  delta: number;
  beforePoints: number;
  afterPoints: number;
  title: string | null;
  reason: string | null;
  actor: { userId: number | null; nickname: string | null };
  eventId: number | null;
  claimId: number | null;
  createdAt: string;
};

export type PointsHistoryPaged = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: PointsHistoryRow[];
};

export type NicknameChangeLogItem = {
  id: number;
  userId: number;
  previousNickname: string;
  newNickname: string;
  createdAt: string;
};

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private http = inject(HttpClient);

  leaderboard(limit = 100) {
    let p = new HttpParams();
    p = p.set('limit', String(limit));
    return this.http.get<LeaderboardRow[]>(`${API_BASE}/users/leaderboard`, {
      params: p,
      withCredentials: true,
    });
  }

  list() {
    return this.http.get<SafeUser[]>(`${API_BASE}/users`, { withCredentials: true });
  }

  pending() {
    return this.http.get<SafeUser[]>(`${API_BASE}/users/pending`, { withCredentials: true });
  }

  accept(userId: number) {
    return this.http.patch<SafeUser>(`${API_BASE}/users/${userId}/accept`, {}, { withCredentials: true });
  }

  updateScope(userId: number, scope: Roles) {
    return this.http.patch<SafeUser>(
      `${API_BASE}/users/${userId}/scope`,
      { scope },
      { withCredentials: true },
    );
  }

  publicProfile(id: number) {
    return this.http.get<PublicUserProfile>(`${API_BASE}/users/${id}/profile`, {
      withCredentials: true,
    });
  }

  updateMyNickname(nickname: string) {
    return this.http.patch<SafeUser>(`${API_BASE}/users/me/nickname`, { nickname: nickname.trim() }, {
      withCredentials: true,
    });
  }

  getMyNicknameHistory() {
    return this.http.get<NicknameChangeLogItem[]>(`${API_BASE}/users/me/nickname-history`, {
      withCredentials: true,
    });
  }

  /** Histórico de nicknames de um usuário (visível para qualquer autenticado). */
  getNicknameHistory(userId: number) {
    return this.http.get<NicknameChangeLogItem[]>(`${API_BASE}/users/${userId}/nickname-history`, {
      withCredentials: true,
    });
  }

  publicEventHistory(id: number, params: { page: number; pageSize: number; q?: string }) {
    let p = new HttpParams();
    p = p.set('page', String(params.page));
    p = p.set('pageSize', String(params.pageSize));
    if (params.q) p = p.set('q', params.q);

    return this.http.get<UserEventHistoryPaged>(`${API_BASE}/users/${id}/event-history`, {
      params: p,
      withCredentials: true,
    });
  }

  pointsHistory(id: number, params: { page: number; pageSize: number; q?: string }) {
    let p = new HttpParams();
    p = p.set('page', String(params.page));
    p = p.set('pageSize', String(params.pageSize));
    if (params.q) p = p.set('q', params.q);

    return this.http.get<PointsHistoryPaged>(`${API_BASE}/users/${id}/points-history`, {
      params: p,
      withCredentials: true,
    });
  }

  manualClaim(userId: number, payload: AdminManualClaimDto) {
    return this.http.post(`${API_BASE}/users/${userId}/manual-claim`, payload, {
      withCredentials: true,
    });
  }

  adjustPoints(userId: number, payload: AdjustPointsDto) {
    return this.http.patch(`${API_BASE}/users/${userId}/points`, payload, {
      withCredentials: true,
    });
  }
}