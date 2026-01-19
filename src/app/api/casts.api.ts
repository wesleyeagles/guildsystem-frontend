import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const API_BASE = environment.apiUrl;

export type CastSource = 'Force' | 'ClassSkill' | 'Skill';
export type CastType = 'Buff' | 'Debuff' | 'ForceAttack' | 'Skill';
export type CastEffectFormat = 'raw' | 'pct01' | 'pct100' | 'pct10' | 'flag' | 'ms';

export type CastEffect = {
  key: string;
  label: string;
  format?: CastEffectFormat;
  values: number[];
};

export type Cast = {
  id: number;
  source: CastSource;
  type: CastType;
  code: string;
  icon: number;
  name: string;
  imagePath: string;
  isActive: boolean;
  description: string | null;
  effects: CastEffect[];
  createdAt: string;
  updatedAt: string;
};

@Injectable({ providedIn: 'root' })
export class CastsApi {
  private http = inject(HttpClient);

  list(params?: { type?: CastType }) {
    const qs = params?.type ? `?type=${encodeURIComponent(params.type)}` : '';
    return this.http.get<Cast[]>(`${API_BASE}/cast${qs}`);
  }

  listAll(params?: { type?: CastType }) {
    const qs = params?.type ? `?type=${encodeURIComponent(params.type)}` : '';
    return this.http.get<Cast[]>(`${API_BASE}/cast/all${qs}`);
  }

  get(id: number) {
    return this.http.get<Cast>(`${API_BASE}/cast/${id}`);
  }

  importAll(payload?: { preferredSheetIndex?: number; tileSize?: number; dataDir?: string }) {
    return this.http.post<any>(`${API_BASE}/cast/import`, payload ?? {});
  }

  remove(id: number) {
    return this.http.delete<{ ok: true }>(`${API_BASE}/cast/${id}`);
  }
}
