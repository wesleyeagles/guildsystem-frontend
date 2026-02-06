// src/app/api/items-catalog.api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { Observable } from 'rxjs';

export type CatalogType = 'weapon' | 'armor' | 'accessory';

export type CatalogItemDto = {
  itemType: CatalogType | string;
  itemId: number;
  name: string;
  label: string;
  imagePath: string | null;
};

export type CatalogResponseDto = {
  items: CatalogItemDto[];
  nextCursor: string | null;
};

function asStr(v: any) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

function asNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

@Injectable({ providedIn: 'root' })
export class ItemsCatalogApi {
  private http = inject(HttpClient);

  private baseUrl = (environment as any).apiUrl
    ? String((environment as any).apiUrl).replace(/\/+$/, '')
    : '';

  private root = `${this.baseUrl}/auctions/catalog`;

  search(paramsIn: {
    type: CatalogType;
    q?: string | null;
    limit?: number | null;
    cursor?: string | null;

    minLevel?: number | null;
    maxLevel?: number | null;

    excludeGrade?: string | null;
    requireEffects?: boolean | null;
  }): Observable<CatalogResponseDto> {
    let params = new HttpParams().set('type', paramsIn.type);

    const q = asStr(paramsIn.q);
    if (q) params = params.set('q', q);

    const limit = asNum(paramsIn.limit);
    if (limit != null) params = params.set('limit', String(limit));

    const cursor = asStr(paramsIn.cursor);
    if (cursor) params = params.set('cursor', cursor);

    const minLevel = asNum(paramsIn.minLevel);
    if (minLevel != null) params = params.set('minLevel', String(minLevel));

    const maxLevel = asNum(paramsIn.maxLevel);
    if (maxLevel != null) params = params.set('maxLevel', String(maxLevel));

    const ex = asStr(paramsIn.excludeGrade);
    if (ex) params = params.set('excludeGrade', ex);

    if (paramsIn.requireEffects != null) {
      params = params.set('requireEffects', paramsIn.requireEffects ? 'true' : 'false');
    }

    return this.http.get<CatalogResponseDto>(this.root, { params });
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
