import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

const API_BASE = environment.apiUrl;

export type DonationStatus = 'pending' | 'approved' | 'rejected';

export type DonationMyStatus = {
  status: 'can_donate' | 'pending' | 'cooldown';
  nextDonationAt?: string;
  lastDonation?: {
    amount: number;
    points: number;
    createdAt: string;
    status: DonationStatus;
  };
};

export type DonationListItem = {
  id: number;
  userId: number;
  amount: number;
  points: number;
  status: DonationStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByUserId: number | null;
  user: { userId: number; nickname: string | null };
};

export type DonationsListResponse = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: DonationListItem[];
};

export const DONATION_OPTIONS = [
  { amount: 25, label: '25kk', points: 10 },
  { amount: 50, label: '50kk', points: 20 },
  { amount: 100, label: '100kk', points: 40 },
] as const;

@Injectable({ providedIn: 'root' })
export class DonationsApi {
  private http = inject(HttpClient);

  create(amount: 25 | 50 | 100) {
    return this.http.post<{ id: number; userId: number; amount: number; points: number; status: string }>(
      `${API_BASE}/donations`,
      { amount },
      { withCredentials: true },
    );
  }

  myStatus() {
    return this.http.get<DonationMyStatus>(`${API_BASE}/donations/me/status`, { withCredentials: true });
  }

  list(params: { page?: number; pageSize?: number; status?: DonationStatus }) {
    const p = new URLSearchParams();
    if (params.page != null) p.set('page', String(params.page));
    if (params.pageSize != null) p.set('pageSize', String(params.pageSize));
    if (params.status) p.set('status', params.status);
    const q = p.toString();
    return this.http.get<DonationsListResponse>(`${API_BASE}/donations${q ? `?${q}` : ''}`, {
      withCredentials: true,
    });
  }

  approve(id: number) {
    return this.http.patch<{ ok: boolean; pointsAdded: number }>(
      `${API_BASE}/donations/${id}/approve`,
      {},
      { withCredentials: true },
    );
  }

  reject(id: number) {
    return this.http.patch<{ ok: boolean }>(`${API_BASE}/donations/${id}/reject`, {}, { withCredentials: true });
  }
}
