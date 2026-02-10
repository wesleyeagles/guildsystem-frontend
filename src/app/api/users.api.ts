import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type Roles = 'none' | 'readonly' | 'moderator' | 'admin' | 'root';

export type SafeUser = {
  id: number;
  email: string;
  scope: Roles;
  nickname: string;
  points: number;
  accepted: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  discordId?: string | null;
  discordUsername?: string | null;
  discordDiscriminator?: string | null;
  discordAvatar?: string | null;
  discordLinkedAt?: string | null;
};

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
  claimId: number;            // ✅ novo
  eventId: number;            // ✅ novo
  title: string;
  definitionCode: string | null;
  points: number;
  mult: number;
  createdAt: string;
  addBy: string | null;
  reversedAt: string | null;  // ✅ novo
  reverseReason: string | null; // ✅ novo
};

export type UserEventHistoryPaged = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: UserEventHistoryRow[];
};

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private http = inject(HttpClient);

  leaderboard(limit = 100) {
    return this.http.get<LeaderboardRow[]>(`${API_BASE}/users/leaderboard`, {
      params: { limit: String(limit) },
      withCredentials: true,
    });
  }

  pending() {
    return this.http.get<SafeUser[]>(`${API_BASE}/users/pending`, { withCredentials: true });
  }

  accept(id: number) {
    return this.http.patch<SafeUser>(`${API_BASE}/users/${id}/accept`, {}, { withCredentials: true });
  }

  list() {
    return this.http.get<SafeUser[]>(`${API_BASE}/users`, { withCredentials: true });
  }

  getById(id: number) {
    return this.http.get<SafeUser>(`${API_BASE}/users/${id}`, { withCredentials: true });
  }

  updateScope(id: number, scope: Roles) {
    return this.http.patch<SafeUser>(`${API_BASE}/users/${id}/scope`, { scope }, { withCredentials: true });
  }

  publicProfile(userId: number) {
    return this.http.get<PublicUserProfile>(`${API_BASE}/users/${userId}/profile`, { withCredentials: true });
  }

  publicEventHistory(userId: number, params: { page: number; pageSize: number; q?: string }) {
    const qp: Record<string, string> = {
      page: String(params.page),
      pageSize: String(params.pageSize),
    };

    const q = params['q'];
    if (q) qp['q'] = String(q);

    return this.http.get<UserEventHistoryPaged>(`${API_BASE}/users/${userId}/event-history`, {
      params: qp,
      withCredentials: true,
    });
  }

  // ✅ admin: criar participação manual (gera logs + histórico)
  manualClaim(userId: number, payload: { title: string; points: number; reason?: string | null }) {
    return this.http.post(
      `${API_BASE}/users/${userId}/manual-claim`,
      payload,
      { withCredentials: true },
    );
  }

  // ✅ admin: ajustar pontos direto (sem logs)
  adjustPoints(userId: number, delta: number) {
    return this.http.patch(
      `${API_BASE}/users/${userId}/points`,
      { delta },
      { withCredentials: true },
    );
  }
}
