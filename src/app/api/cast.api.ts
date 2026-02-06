// src/app/api/cast.api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { Observable } from 'rxjs';

export type CastType = 'Buff' | 'Debuff' | 'ForceAttack' | 'Skill' | string;

export type CastDto = {
  id: number;
  type: CastType;
  code: string;
  icon: number;
  name: string;
  imagePath: string;
  isActive: boolean;
  description: string | null;
};

function asStr(v: any) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

@Injectable({ providedIn: 'root' })
export class CastApi {
  private http = inject(HttpClient);

  private baseUrl = (environment as any).apiUrl
    ? String((environment as any).apiUrl).replace(/\/+$/, '')
    : '';

  private root = `${this.baseUrl}/cast`;

  list(type?: CastType): Observable<CastDto[]> {
    let params = new HttpParams();
    const t = asStr(type);
    if (t) params = params.set('type', t);
    return this.http.get<CastDto[]>(this.root, { params });
  }

  resolveImageUrl(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;
    const s = String(imagePath);
    if (/^https?:\/\//i.test(s)) return s;
    if (!this.baseUrl) return s;
    if (s.startsWith('/')) return `${this.baseUrl}${s}`;
    return `${this.baseUrl}/${s}`;
  }
}
