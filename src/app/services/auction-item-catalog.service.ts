// src/app/services/auction-item-catalog.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { API_BASE } from '../api/auctions.api';
import { EMPTY, Observable, forkJoin, shareReplay } from 'rxjs';
import { expand, map, reduce, tap } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';

export type AuctionCatalogEffect = { label: string; value: number };

export type AuctionCatalogItem = {
  itemType: 'weapon' | 'armor' | 'accessory';
  itemId: number;

  name: string;
  label: string;

  imagePath: string | null;

  level?: number;
  gradeName?: string | null;
  slot?: string | null;

  effects?: AuctionCatalogEffect[];
};

export type AuctionItemRef = {
  itemType: string;
  itemId: number;
  slot?: string | null;
};

export type CatalogType = 'weapon' | 'armor' | 'accessory';

export type CatalogQuery = {
  type: CatalogType;
  q?: string;
  limit?: number;
  cursor?: string | null;

  minLevel?: number;
  maxLevel?: number;
  excludeGrade?: string;
  requireEffects?: boolean;
};

export type CatalogResponse = {
  items: AuctionCatalogItem[];
  nextCursor: string | null;
};

function asStr(v: any) {
  return String(v ?? '').trim();
}

function normType(t: any): CatalogType | null {
  const s = asStr(t).toLowerCase();
  if (s === 'weapon' || s === 'armor' || s === 'accessory') return s;
  return null;
}

function keyOfRef(ref: AuctionItemRef) {
  const t = normType(ref?.itemType) ?? asStr(ref?.itemType).toLowerCase();
  const id = Number(ref?.itemId) || 0;
  const slot = asStr(ref?.slot ?? '');
  return `${t}:${id}:${slot}`;
}

function keyOfItem(it: AuctionCatalogItem) {
  const t = normType(it?.itemType) ?? asStr(it?.itemType).toLowerCase();
  const id = Number(it?.itemId) || 0;
  const slot = asStr(it?.slot ?? '');
  return `${t}:${id}:${slot}`;
}

@Injectable({ providedIn: 'root' })
export class AuctionItemCatalogService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // ✅ cache curto (evita re-hit quando abre/fecha select)
  private cache = new Map<string, Observable<CatalogResponse>>();

  // ✅ cache do “loadAll” (pra compatibilidade com telas antigas)
  private all$?: Observable<AuctionCatalogItem[]>;
  private index = new Map<string, AuctionCatalogItem>();

  private buildAuthHeaders(): HttpHeaders {
    // tenta pegar token de formas comuns
    const anyAuth: any = this.auth as any;

    const token =
      (typeof anyAuth.getAccessToken === 'function' ? anyAuth.getAccessToken() : null) ||
      (typeof anyAuth.accessToken === 'function' ? anyAuth.accessToken() : null) ||
      anyAuth.accessToken ||
      anyAuth.token ||
      null;

    const t = String(token ?? '').trim();
    if (!t) return new HttpHeaders();

    return new HttpHeaders().set('Authorization', `Bearer ${t}`);
  }

  /**
   * Query paginada (cursor) - endpoint recomendado pra performance.
   */
  query(params: CatalogQuery): Observable<CatalogResponse> {
    const base = API_BASE.replace(/\/$/, '');
    const url = `${base}/auctions/catalog`;

    const q = asStr(params.q);
    const limit = params.limit ?? 60;

    let httpParams = new HttpParams().set('type', params.type).set('limit', String(limit));

    if (q) httpParams = httpParams.set('q', q);
    if (params.cursor) httpParams = httpParams.set('cursor', String(params.cursor));

    if (params.minLevel != null) httpParams = httpParams.set('minLevel', String(params.minLevel));
    if (params.maxLevel != null) httpParams = httpParams.set('maxLevel', String(params.maxLevel));
    if (params.excludeGrade) httpParams = httpParams.set('excludeGrade', params.excludeGrade);
    if (params.requireEffects) httpParams = httpParams.set('requireEffects', '1');

    // ✅ adiciona Bearer (evita 401/403 se não tiver interceptor)
    const headers = this.buildAuthHeaders();

    // cache só pra “lista base” (sem busca e sem cursor)
    const cacheable = !q && !params.cursor;
    const key = cacheable
      ? `base:${params.type}:${limit}:${params.minLevel ?? ''}:${params.maxLevel ?? ''}:${params.excludeGrade ?? ''}:${
          params.requireEffects ? 1 : 0
        }`
      : '';

    if (cacheable) {
      const hit = this.cache.get(key);
      if (hit) return hit;

      const req$ = this.http
        .get<CatalogResponse>(url, { params: httpParams, headers })
        .pipe(shareReplay({ bufferSize: 1, refCount: false, windowTime: 60_000 }));

      this.cache.set(key, req$);
      return req$;
    }

    return this.http.get<CatalogResponse>(url, { params: httpParams, headers });
  }

  /**
   * ✅ COMPAT: telas antigas chamam loadAll(false) e depois find(ref).
   * Implementação paginada com cursor (sem estourar 1 request gigante).
   *
   * force=true -> ignora cache e refaz.
   */
  loadAll(force = false): Observable<AuctionCatalogItem[]> {
    if (!force && this.all$) return this.all$;

    const pageLimit = 200;

    const loadTypeAll = (q: CatalogQuery) => {
      const first: CatalogQuery = { ...q, cursor: null, limit: q.limit ?? pageLimit };
      return this.query(first).pipe(
        expand((res) => (res?.nextCursor ? this.query({ ...q, cursor: res.nextCursor, limit: first.limit }) : EMPTY)),
        map((res) => (Array.isArray(res?.items) ? res.items : [])),
        reduce((acc, items) => acc.concat(items), [] as AuctionCatalogItem[]),
      );
    };

    const weapons$ = loadTypeAll({
      type: 'weapon',
      q: '',
      limit: pageLimit,
      minLevel: 46,
      maxLevel: 55,
      excludeGrade: 'Normal',
    });

    const armors$ = loadTypeAll({
      type: 'armor',
      q: '',
      limit: pageLimit,
      minLevel: 46,
    });

    const accessories$ = loadTypeAll({
      type: 'accessory',
      q: '',
      limit: pageLimit,
      requireEffects: true,
    });

    this.all$ = forkJoin([weapons$, armors$, accessories$]).pipe(
      map(([w, a, x]) => [...w, ...a, ...x]),
      tap((items) => {
        this.index.clear();
        for (const it of items) this.index.set(keyOfItem(it), it);
      }),
      shareReplay({ bufferSize: 1, refCount: false, windowTime: 10 * 60_000 }),
    );

    return this.all$;
  }

  /**
   * ✅ COMPAT: resolve ref -> item (quando já carregado via loadAll).
   */
  find(ref: AuctionItemRef): AuctionCatalogItem | null {
    if (!ref) return null;
    return this.index.get(keyOfRef(ref)) ?? null;
  }

  clearCache() {
    this.cache.clear();
    this.all$ = undefined;
    this.index.clear();
  }

  weapons(q: string, cursor: string | null, limit = 60) {
    return this.query({
      type: 'weapon',
      q,
      cursor,
      limit,
      minLevel: 46,
      maxLevel: 55,
      excludeGrade: 'Normal',
    });
  }

  armors(q: string, cursor: string | null, limit = 60) {
    return this.query({
      type: 'armor',
      q,
      cursor,
      limit,
      minLevel: 46,
    });
  }

  accessories(q: string, cursor: string | null, limit = 60) {
    return this.query({
      type: 'accessory',
      q,
      cursor,
      limit,
      requireEffects: true,
    });
  }
}
