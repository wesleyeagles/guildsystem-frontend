// src/app/api/items.api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { Observable } from 'rxjs';

export const ITEM_CATEGORIES = [
  'Weapon',
  'Shield',
  'Armor',
  'Accessory',
  'Resource',
  'Booty',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const WEAPON_TYPES = [
  'Knife',
  'Sword',
  'Axe',
  'Mace',
  'Staff',
  'Spear',
  'Bow',
  'Firearm',
  'Launcher',
  'Flame Thrower',
  'Grenade Launcher',
] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const ARMOR_TYPES = ['Helmet', 'Upper', 'Lower', 'Gloves', 'Shoes'] as const;
export type ArmorType = (typeof ARMOR_TYPES)[number];

export const ACCESSORY_TYPES = ['Ring', 'Amulet'] as const;
export type AccessoryType = (typeof ACCESSORY_TYPES)[number];

export type ItemType = WeaponType | ArmorType | AccessoryType;

export const ITEM_RACES = ['Accretia', 'Cora', 'Bellato', 'All Races'] as const;
export type ItemRace = (typeof ITEM_RACES)[number];

export const ARMOR_CLASSES = ['Warrior', 'Ranger', 'Force', 'Launcher'] as const;
export type ArmorClass = (typeof ARMOR_CLASSES)[number];

export const ITEM_ELEMENTS = ['Fire', 'Water', 'Earth', 'Wind'] as const;
export type ItemElement = (typeof ITEM_ELEMENTS)[number];

export const WEAPON_GRADES = [
  'Normal',
  'Rare A',
  'Rare B',
  'Rare C',
  'Rare D',
  'Leon',
  'Relic',
  'PVP',
] as const;
export type WeaponGrade = (typeof WEAPON_GRADES)[number];

export const ARMOR_SHIELD_GRADES = [
  'Normal',
  'Rare B',
  'Rare C',
  'Rare D',
  'Superior',
  'Hero',
] as const;
export type ArmorShieldGrade = (typeof ARMOR_SHIELD_GRADES)[number];

export type ItemGrade = WeaponGrade | ArmorShieldGrade;

export type ItemDto = {
  id: number;

  category: ItemCategory;
  type: ItemType | null;

  name: string;

  imagePath: string | null;

  description: string | null;

  // ✅ novo: só Resource/Booty no backend, mas no DTO sempre existe (null pros outros)
  quantity: number | null;

  race: ItemRace | null;
  level: number | null;
  grade: string | null;

  attackMin: number | null;
  attackMax: number | null;
  forceAttackMin: number | null;
  forceAttackMax: number | null;
  castId: number | null;

  armorClass: string | null;
  defense: number | null;
  defenseSuccessRate: number | null;

  elements: string[] | null;

  specialEffects: string[];
  upgradeLevel: number | null;

  createdAt: string;
  updatedAt: string;
};

export type ItemsPageResponseDto = {
  items: ItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ItemsPageQuery = {
  page?: number;
  pageSize?: number;

  q?: string | null;

  category?: ItemCategory | null;
  type?: ItemType | null;
  race?: ItemRace | null;

  minLevel?: number | null;
  maxLevel?: number | null;
};

export type CreateItemPayload = {
  category: ItemCategory;
  type?: ItemType | null;

  name: string;

  imagePath?: string | null;

  description?: string | null;

  // ✅ novo
  quantity?: number | null;

  race?: ItemRace | null;
  level?: number | null;
  grade?: ItemGrade | string | null;

  attackMin?: number | null;
  attackMax?: number | null;
  forceAttackMin?: number | null;
  forceAttackMax?: number | null;
  castId?: number | null;

  armorClass?: ArmorClass | string | null;
  defense?: number | null;
  defenseSuccessRate?: number | null;

  elements?: ItemElement[] | string[] | null;

  specialEffects?: string[] | null;
  upgradeLevel?: number | null;
};

export type UpdateItemPayload = Partial<CreateItemPayload>;

function asStr(v: any) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function asNum(v: any) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function withParam(params: HttpParams, key: string, value: any): HttpParams {
  const v = asStr(value);
  return v === undefined ? params : params.set(key, v);
}

function withNum(params: HttpParams, key: string, value: any): HttpParams {
  const n = asNum(value);
  return n === undefined ? params : params.set(key, String(n));
}

@Injectable({ providedIn: 'root' })
export class ItemsApi {
  private http = inject(HttpClient);

  private baseUrl = (environment as any).apiUrl
    ? String((environment as any).apiUrl).replace(/\/+$/, '')
    : '';

  private root = `${this.baseUrl}/items`;

  page(query: ItemsPageQuery = {}): Observable<ItemsPageResponseDto> {
    let params = new HttpParams();

    params = withNum(params, 'page', query.page ?? 1);
    params = withNum(params, 'pageSize', query.pageSize ?? 25);

    params = withParam(params, 'q', query.q ?? undefined);

    params = withParam(params, 'category', query.category ?? undefined);
    params = withParam(params, 'type', query.type ?? undefined);
    params = withParam(params, 'race', query.race ?? undefined);

    params = withNum(params, 'minLevel', query.minLevel ?? undefined);
    params = withNum(params, 'maxLevel', query.maxLevel ?? undefined);

    return this.http.get<ItemsPageResponseDto>(this.root, { params });
  }

  getById(id: number): Observable<ItemDto> {
    return this.http.get<ItemDto>(`${this.root}/${id}`);
  }

  create(payload: CreateItemPayload): Observable<ItemDto> {
    return this.http.post<ItemDto>(this.root, payload);
  }

  update(id: number, payload: UpdateItemPayload): Observable<ItemDto> {
    return this.http.put<ItemDto>(`${this.root}/${id}`, payload);
  }

  remove(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.root}/${id}`);
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
