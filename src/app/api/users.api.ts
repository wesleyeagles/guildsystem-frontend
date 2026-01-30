import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type LeaderboardRow = {
  nickname: string;
  points: number;
  lastEventAt: string | null;
  lastEventTitle: string | null;
  lastEventDefinitionCode: string | null;
};

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

  updateScope(id: number, scope: Roles) {
    return this.http.patch<SafeUser>(
      `${API_BASE}/users/${id}/scope`,
      { scope },
      { withCredentials: true },
    );
  }
}
