// src/app/services/auction-item-catalog.service.ts
import { Injectable, inject } from '@angular/core';
import { ItemsApi, type ItemCategory, type ItemDto } from '../api/items.api';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';

export type AuctionItemRef = {
  itemType: string; // guarda a categoria (ex: "Weapon") ou legacy ("weapon")
  itemId: number;
  slot?: string | null;
};

export type AuctionCatalogEffectDto = {
  label: string;
  value: number; // assinado
};

export type AuctionCatalogItem = {
  itemType: string; // "Weapon" | "Armor" | ...
  itemId: number;

  name: string;
  label: string;

  imagePath: string | null;

  // opcionais (mantidos pra compat)
  level?: number | null;
  gradeName?: string | null;
  slot?: string | null;

  effects?: AuctionCatalogEffectDto[];
};

export type AuctionsCatalogResponse = {
  items: AuctionCatalogItem[];
  nextCursor: string | null; // aqui é "page" em string
};

function asStr(v: any) {
  return String(v ?? '').trim();
}
function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function nz(n: any): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function buildLabel(it: ItemDto): string {
  const parts: string[] = [];

  if (it.type) parts.push(String(it.type));
  if (it.race) parts.push(String(it.race));
  if (it.level != null) parts.push(`Lv ${it.level}`);
  if (it.grade) parts.push(String(it.grade));

  return parts.join(' • ') || String(it.category);
}

function buildEffects(it: ItemDto): AuctionCatalogEffectDto[] {
  // Não dá pra recriar o “efeito real” do catalog antigo sem a fonte antiga.
  // Aqui vai um snapshot básico útil (numérico) para chips, sem inventar muito:
  const out: AuctionCatalogEffectDto[] = [];

  const atkMax = nz(it.attackMax);
  const def = nz(it.defense);
  const faMax = nz(it.forceAttackMax);
  const defRate = nz(it.defenseSuccessRate);

  if (atkMax != null && atkMax !== 0) out.push({ label: 'Attack', value: Math.abs(atkMax) });
  if (faMax != null && faMax !== 0) out.push({ label: 'Force Attack', value: Math.abs(faMax) });
  if (def != null && def !== 0) out.push({ label: 'Defense', value: Math.abs(def) });
  if (defRate != null && defRate !== 0) out.push({ label: 'Defense Success Rate', value: Math.abs(defRate) });

  // Limita (evita tooltip/chips gigantes)
  return out.slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class AuctionItemCatalogService {
  private itemsApi = inject(ItemsApi);

  /**
   * Cursor aqui é só o "page" em string.
   * - cursor null => page 1
   * - nextCursor => page+1 enquanto houver mais páginas
   */
  byCategory(
    category: ItemCategory,
    q: string,
    cursor: string | null,
    limit = 60,
  ): Observable<AuctionsCatalogResponse> {
    const page = cursor ? Math.max(1, asInt(cursor, 1)) : 1;

    return this.itemsApi
      .page({
        page,
        pageSize: limit,
        q: asStr(q) || null,
        category,
      })
      .pipe(
        map((res) => {
          const items: AuctionCatalogItem[] = (res.items ?? []).map((it) => ({
            itemType: it.category, // salva a categoria nova (ex: "Weapon")
            itemId: it.id,
            name: it.name,
            label: buildLabel(it),
            imagePath: it.imagePath ?? null,
            level: it.level ?? null,
            gradeName: it.grade ?? null,
            slot: it.type ?? null,
            effects: buildEffects(it),
          }));

          const hasMore = (res.page ?? page) < (res.totalPages ?? 1);
          const nextCursor = hasMore ? String((res.page ?? page) + 1) : null;

          return { items, nextCursor };
        }),
      );
  }
}
