// src/app/services/auction-item-catalog.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, tap } from 'rxjs';
import { API_BASE } from '../api/auctions.api';

export type AuctionItemType = 'weapon' | 'armor' | 'accessory';

export type AuctionItemRef = {
  itemType: AuctionItemType;
  itemId: number;
  slot?: 'helmet' | 'upper' | 'lower' | 'gloves' | 'shoes' | 'ring' | 'amulet';
};

export type AuctionCatalogEffect = {
  key?: string;
  label: string;
  value?: string | number;
};

export type AuctionCatalogItem = AuctionItemRef & {
  name: string;
  imagePath: string | null;
  label: string;

  level?: number;

  /**
   * ✅ effects no formato já “apresentável”
   * label = e.effect
   * value = com sinal (+/-) aplicado
   */
  effects?: AuctionCatalogEffect[];

  /**
   * ✅ extras pra filtros e UI (weapon principalmente)
   * (mantém opcional pra não quebrar nada)
   */
  gradeName?: string;
  attack?: { min: number; max: number };
  forceAttack?: { min: number; max: number };
  cast?: { id: number; name: string; imagePath: string } | null;
};

function toInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asStr(v: any) {
  return String(v ?? '').trim();
}

function pickName(raw: any) {
  return (
    asStr(raw?.name) ||
    asStr(raw?.title) ||
    asStr(raw?.displayName) ||
    asStr(raw?.itemName) ||
    `Item ${toInt(raw?.id)}`
  );
}

function pickImage(raw: any) {
  const s = asStr(raw?.imagePath) || asStr(raw?.iconPath) || asStr(raw?.img) || asStr(raw?.image) || '';
  return s || null;
}

function pickLevel(raw: any) {
  const lv =
    toInt(raw?.level) ||
    toInt(raw?.lvl) ||
    toInt(raw?.requiredLevel) ||
    toInt(raw?.reqLevel) ||
    toInt(raw?.data?.level) ||
    toInt(raw?.data?.requiredLevel) ||
    0;

  return lv > 0 ? lv : undefined;
}

function normalizeNameKey(name: string) {
  const s = asStr(name).toLowerCase();
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * ✅ suporta payload real:
 * { effect: string, value: number, typeNum: 'Increase'|'Decrease' }
 */
function normalizeEffect(raw: any): AuctionCatalogEffect | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    const s = asStr(raw);
    return s ? { label: s } : null;
  }

  const label = asStr(raw?.effect) || asStr(raw?.label ?? raw?.text ?? raw?.name ?? raw?.key ?? raw?.code);
  if (!label) return null;

  const typeNum = asStr(raw?.typeNum);
  const valueNum =
    raw?.value === undefined || raw?.value === null || raw?.value === '' ? undefined : Number(raw?.value);

  let value: number | string | undefined = undefined;

  if (valueNum !== undefined && Number.isFinite(valueNum)) {
    if (typeNum.toLowerCase() === 'decrease') value = -Math.abs(valueNum);
    else if (typeNum.toLowerCase() === 'increase') value = Math.abs(valueNum);
    else value = valueNum;
  } else {
    const v = raw?.amount ?? raw?.val ?? raw?.unit ?? raw?.number ?? undefined;
    value = v === undefined || v === null || v === '' ? undefined : (v as any);
  }

  const key = asStr(raw?.key ?? raw?.code ?? raw?.id ?? raw?.effect);
  return { key: key || undefined, label, value };
}

function extractEffects(raw: any): AuctionCatalogEffect[] {
  const candidates = [
    raw?.effects,
    raw?.data?.effects,
    raw?.accessoryEffects,
    raw?.data?.accessoryEffects,
    raw?.bonus,
    raw?.data?.bonus,
    raw?.data?.specialEffects,
    raw?.specialEffects,
  ];

  const arr = candidates.find((x) => Array.isArray(x)) as any[] | undefined;
  if (!arr) return [];

  const out: AuctionCatalogEffect[] = [];
  for (const e of arr) {
    const n = normalizeEffect(e);
    if (n) out.push(n);
  }

  // dedupe por label+value
  const seen = new Set<string>();
  const dedup: AuctionCatalogEffect[] = [];
  for (const e of out) {
    const k = `${normalizeNameKey(e.label)}::${normalizeNameKey(asStr(e.value))}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(e);
  }

  return dedup;
}

@Injectable({ providedIn: 'root' })
export class AuctionItemCatalogService {
  private http = inject(HttpClient);

  private items$ = new BehaviorSubject<AuctionCatalogItem[]>([]);
  private loaded = false;

  /**
   * ✅ filtro pesado no CATÁLOGO:
   * weapon/armor:
   * - level > 45 && < 56  => (46..55)
   * - weapon grade != Normal
   *
   * accessories:
   * - sem regra de level aqui (mas você filtra no select por effects)
   */
  private readonly WEAPON_MIN_LEVEL_EXCLUSIVE = 45;
  private readonly WEAPON_MAX_LEVEL_EXCLUSIVE = 56;
  private readonly ARMOR_MIN_LEVEL_EXCLUSIVE = 50;
  private readonly ARMOR_MAX_LEVEL_EXCLUSIVE = 55;

  watch(): Observable<AuctionCatalogItem[]> {
    return this.items$.asObservable();
  }

  snapshot(): AuctionCatalogItem[] {
    return this.items$.value;
  }

  loadAll(force = false): Observable<AuctionCatalogItem[]> {
    if (this.loaded && !force) return of(this.items$.value);

    // ✅ endpoint real: /weapon
    const weapons$ = this.http.get<any[]>(`${API_BASE}/weapon`).pipe(
      map((arr) => this.normalizeWeapons(arr)),
      catchError(() => of([] as AuctionCatalogItem[])),
    );

    const armorSlots: Array<AuctionItemRef['slot']> = ['helmet', 'upper', 'lower', 'gloves', 'shoes'];
    const armorCalls = armorSlots.map((slot) =>
      this.http.get<any[]>(`${API_BASE}/armor/${slot}`).pipe(
        map((arr) => this.normalizeArmor(arr, slot)),
        catchError(() => of([] as AuctionCatalogItem[])),
      ),
    );

    const accessorySlots: Array<AuctionItemRef['slot']> = ['ring', 'amulet'];
    const accessoryCalls = accessorySlots.map((slot) =>
      this.http.get<any[]>(`${API_BASE}/accessories/${slot}`).pipe(
        map((arr) => this.normalizeAccessory(arr, slot)),
        catchError(() => of([] as AuctionCatalogItem[])),
      ),
    );

    return forkJoin([weapons$, ...armorCalls, ...accessoryCalls]).pipe(
      map((lists) => lists.flat()),
      map((all) => this.dedupeAndReduce(all)),
      tap((all) => {
        this.loaded = true;
        this.items$.next(all);
      }),
    );
  }

  search(term: string): AuctionCatalogItem[] {
    const q = asStr(term).toLowerCase();
    if (!q) return this.snapshot();
    return this.snapshot().filter((it) => {
      const fx = (it.effects ?? []).map((e) => `${e.label} ${e.value ?? ''}`).join(' ');
      const base = `${it.label} ${it.name} ${it.itemType} ${it.slot ?? ''} ${it.gradeName ?? ''} ${fx}`.toLowerCase();
      return base.includes(q);
    });
  }

  find(ref: AuctionItemRef): AuctionCatalogItem | null {
    const id = toInt(ref.itemId);
    const type = ref.itemType;
    const slot = ref.slot ?? undefined;

    return this.snapshot().find((x) => x.itemType === type && x.itemId === id && (slot ? x.slot === slot : true)) ?? null;
  }

  private normalizeWeapons(arr: any[]): AuctionCatalogItem[] {
    const out: AuctionCatalogItem[] = [];

    for (const raw of arr ?? []) {
      const itemId = toInt(raw?.id);
      if (!itemId) continue;

      const name = pickName(raw);
      const imagePath = pickImage(raw);
      const level = pickLevel(raw);

      // ✅ payload real
      const gradeName = asStr(raw?.grade?.name);
      const effects = extractEffects(raw);
      const attack = raw?.attack
        ? { min: toNum(raw?.attack?.min), max: toNum(raw?.attack?.max) }
        : undefined;

      const forceAttack = raw?.forceAttack
        ? { min: toNum(raw?.forceAttack?.min), max: toNum(raw?.forceAttack?.max) }
        : undefined;

      const cast = raw?.cast
        ? {
            id: toInt(raw?.cast?.id),
            name: asStr(raw?.cast?.name),
            imagePath: asStr(raw?.cast?.imagePath),
          }
        : null;

      // ✅ filtro do catálogo (weapon)
      const lv = level ?? 0;
      if (!(lv > this.WEAPON_MIN_LEVEL_EXCLUSIVE && lv < this.WEAPON_MAX_LEVEL_EXCLUSIVE)) continue;
      if (gradeName && gradeName.toLowerCase() === 'normal' || gradeName.toLowerCase() === 'purple') continue;

      out.push({
        itemType: 'weapon',
        itemId,
        name,
        imagePath,
        level,
        gradeName: gradeName || undefined,
        effects: effects.length ? effects : undefined,
        attack,
        forceAttack,
        cast,
        label: `Weapon · ${name}`, // (select não precisa mostrar, mas mantém p/ search/debug)
      });
    }

    return out;
  }

  private normalizeArmor(arr: any[], slot: AuctionItemRef['slot']): AuctionCatalogItem[] {
    const out: AuctionCatalogItem[] = [];
    for (const raw of arr ?? []) {
      const itemId = toInt(raw?.id);
      if (!itemId) continue;

      const name = pickName(raw);
      const imagePath = pickImage(raw);
      const level = pickLevel(raw);

      // ✅ filtro armor (mantém só lvl > 45 se tiver)
      const lv = level ?? 0;
      if (lv && !(lv > this.ARMOR_MIN_LEVEL_EXCLUSIVE && lv < this.ARMOR_MAX_LEVEL_EXCLUSIVE)) continue;

      const fx = extractEffects(raw);
      const gradeName = asStr(raw?.grade?.name);

      out.push({
        itemType: 'armor',
        itemId,
        slot: slot as any,
        name,
        imagePath,
        level,
        gradeName: gradeName || undefined,
        effects: fx.length ? fx : undefined,
        label: `Armor/${slot} · ${name}`,
      });
    }
    return out;
  }

  private normalizeAccessory(arr: any[], slot: AuctionItemRef['slot']): AuctionCatalogItem[] {
    const out: AuctionCatalogItem[] = [];
    for (const raw of arr ?? []) {
      const itemId = toInt(raw?.id);
      if (!itemId) continue;

      const name = pickName(raw);
      const imagePath = pickImage(raw);

      const fx = extractEffects(raw);
      const gradeName = asStr(raw?.grade?.name);

      out.push({
        itemType: 'accessory',
        itemId,
        slot: slot as any,
        name,
        imagePath,
        gradeName: gradeName || undefined,
        effects: fx.length ? fx : undefined,
        label: `Accessory/${slot} · ${name}`,
      });
    }
    return out;
  }

  private dedupeAndReduce(list: AuctionCatalogItem[]) {
    const mapByName = new Map<string, AuctionCatalogItem>();

    for (const it of list) {
      const nameKey = normalizeNameKey(it.name);
      const key = `${it.itemType}:${it.slot ?? ''}:${nameKey}`;

      const prev = mapByName.get(key);
      if (!prev) {
        mapByName.set(key, it);
        continue;
      }

      mapByName.set(key, this.pickBetter(prev, it));
    }

    const out = Array.from(mapByName.values());
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }

  private pickBetter(a: AuctionCatalogItem, b: AuctionCatalogItem): AuctionCatalogItem {
    const aFx = (a.effects?.length ?? 0) > 0;
    const bFx = (b.effects?.length ?? 0) > 0;

    // ✅ prefere quem tem effects (serve pra accessory e weapon/armor também)
    if (aFx !== bFx) return bFx ? b : a;

    const aImg = !!a.imagePath;
    const bImg = !!b.imagePath;

    // ✅ prefere quem tem imagem
    if (aImg !== bImg) return bImg ? b : a;

    // ✅ prefere maior level
    const al = a.level ?? 0;
    const bl = b.level ?? 0;
    if (al !== bl) return bl > al ? b : a;

    // ✅ menor id (estável)
    return b.itemId < a.itemId ? b : a;
  }
}
