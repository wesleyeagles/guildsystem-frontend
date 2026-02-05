import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  claimedByMe?: boolean;
  claimedAt?: string | null;
  claimReversedAt?: string | null;
};

@Injectable({ providedIn: 'root' })
export class EventsApi {
  private http = inject(HttpClient);

  // ✅ Definitions (ativos)
  definitions() {
    return this.http.get<EventDefinition[]>(`${API_BASE}/events/definitions`);
  }

  // ✅ Admin cria definition
  createDefinition(payload: {
    code: string;
    title: string;
    points: number;
    category?: EventCategory;
    isActive?: boolean;
  }) {
    return this.http.post<EventDefinition>(`${API_BASE}/events/definitions`, payload);
  }

  // ✅ Admin edita definition
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

  // ✅ Admin deleta definition (necessário para a tela de objetivos)
  deleteDefinition(id: number) {
    return this.http.delete<{ ok: boolean }>(`${API_BASE}/events/definitions/${id}`);
  }

  active() {
    return this.http.get<ActiveEvent[]>(`${API_BASE}/events/active`);
  }

  create(payload: { definitionCode: string; password: string; durationMinutes: 15 | 30 | 45 | 60; isDoubled?: boolean }) {
    return this.http.post<{ id: number; title: string; points: number; expiresAt: string; isDoubled?: boolean }>(
      `${API_BASE}/events`,
      payload,
    );
  }

  listAdmin() {
    return this.http.get<EventInstance[]>(`${API_BASE}/events/admin`);
  }

  listAll() {
    return this.http.get<EventInstance[]>(`${API_BASE}/events`);
  }

  claim(id: number, password: string) {
    return this.http.post<{ ok: boolean; pointsAdded: number; eventId: number }>(`${API_BASE}/events/${id}/claim`, {
      password,
    });
  }

  cancel(id: number, reason?: string | null) {
    return this.http.patch(`${API_BASE}/events/${id}/cancel`, { reason: reason ?? null });
  }
}
