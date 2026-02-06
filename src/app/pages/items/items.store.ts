// src/app/pages/items/items.store.ts
import { Injectable, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import {
  ItemsApi,
  type ItemDto,
  type ItemsPageQuery,
  type ItemsPageResponseDto,
  type CreateItemPayload,
  type UpdateItemPayload,
} from '../../api/items.api';

import { ItemsSocketService } from '../../services/items-socket.service';
import type { ItemDto as SocketItemDto, WsItemDeleted } from '../../services/items-socket.service';

function uniqByIdDesc(items: ItemDto[]): ItemDto[] {
  const map = new Map<number, ItemDto>();
  for (const it of items) map.set(it.id, it);
  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}

function upsertById(items: ItemDto[], item: ItemDto): ItemDto[] {
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx === -1) return uniqByIdDesc([item, ...items]);
  const copy = items.slice();
  copy[idx] = item;
  return uniqByIdDesc(copy);
}

function removeById(items: ItemDto[], id: number): ItemDto[] {
  return items.filter((x) => x.id !== id);
}

function clampInt(v: any, min: number, max: number, def: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

const CATEGORY_SET = new Set<ItemDto['category']>([
  'Weapon',
  'Shield',
  'Armor',
  'Accessory',
  'Resource',
  'Booty',
]);

function asCategory(v: any): ItemDto['category'] {
  const s = typeof v === 'string' ? v : '';
  return (CATEGORY_SET.has(s as any) ? s : 'Resource') as ItemDto['category'];
}

function fromSocketItem(s: SocketItemDto): ItemDto {
  return {
    id: Number(s.id),

    category: asCategory(s.category),
    type: (s.type ?? null) as any,

    name: String(s.name ?? ''),
    imagePath: s.imagePath ?? null,
    description: s.description ?? null,

    race: (s.race ?? null) as any,
    level: s.level ?? null,
    grade: (s.grade ?? null) as any,

    attackMin: s.attackMin ?? null,
    attackMax: s.attackMax ?? null,
    forceAttackMin: s.forceAttackMin ?? null,
    forceAttackMax: s.forceAttackMax ?? null,
    castId: s.castId ?? null,

    armorClass: (s.armorClass ?? null) as any,
    defense: s.defense ?? null,
    defenseSuccessRate: s.defenseSuccessRate ?? null,

    elements: (s.elements ?? null) as any,

    specialEffects: Array.isArray(s.specialEffects) ? s.specialEffects : [],
    upgradeLevel: s.upgradeLevel ?? null,

    createdAt: String(s.createdAt ?? ''),
    updatedAt: String(s.updatedAt ?? ''),
  };
}

@Injectable({ providedIn: 'root' })
export class ItemsStore {
  private destroyRef = inject(DestroyRef);
  private api = inject(ItemsApi);
  private socket = inject(ItemsSocketService);

  private querySig = signal<ItemsPageQuery>({
    page: 1,
    pageSize: 25,
    q: null,
    category: null,
    type: null,
    race: null,
    minLevel: null,
    maxLevel: null,
  });

  private loadingSig = signal(false);
  private actionSig = signal<'idle' | 'saving' | 'deleting'>('idle');

  private itemsSig = signal<ItemDto[]>([]);
  private totalSig = signal(0);
  private totalPagesSig = signal(1);

  query = computed(() => this.querySig());
  loading = computed(() => this.loadingSig());
  action = computed(() => this.actionSig());

  items = computed(() => this.itemsSig());
  total = computed(() => this.totalSig());
  totalPages = computed(() => this.totalPagesSig());

  constructor() {
    this.socket.ensureConnected();

    this.socket
      .onItemCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((raw) => {
        const item = fromSocketItem(raw);

        const existedBefore = this.itemsSig().some((x) => x.id === item.id);
        this.itemsSig.update((list) => upsertById(list, item));

        if (!existedBefore) {
          this.totalSig.update((n) => n + 1);
          this.totalPagesSig.set(this.computeTotalPages(this.totalSig(), this.querySig().pageSize ?? 25));
        }
      });

    this.socket
      .onItemUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((raw) => {
        const item = fromSocketItem(raw);
        this.itemsSig.update((list) => upsertById(list, item));
      });

    this.socket
      .onItemDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: WsItemDeleted) => {
        const before = this.itemsSig().length;
        this.itemsSig.update((list) => removeById(list, payload.id));
        const after = this.itemsSig().length;

        if (after !== before) {
          this.totalSig.update((n) => Math.max(0, n - 1));
          this.totalPagesSig.set(this.computeTotalPages(this.totalSig(), this.querySig().pageSize ?? 25));
        }
      });
  }

  setQuery(partial: Partial<ItemsPageQuery>, resetPage = false) {
    this.querySig.update((q) => ({
      ...q,
      ...partial,
      page: resetPage ? 1 : (partial.page ?? q.page ?? 1),
    }));
  }

  setPage(page: number) {
    this.querySig.update((q) => ({
      ...q,
      page: clampInt(page, 1, 1_000_000, 1),
    }));
  }

  setPageSize(pageSize: number) {
    const size = clampInt(pageSize, 1, 200, 25);
    this.querySig.update((q) => ({ ...q, pageSize: size, page: 1 }));
  }

  resetFilters() {
    this.querySig.set({
      page: 1,
      pageSize: this.querySig().pageSize ?? 25,
      q: null,
      category: null,
      type: null,
      race: null,
      minLevel: null,
      maxLevel: null,
    });
  }

  async load(): Promise<void> {
    this.socket.ensureConnected();

    const query = this.querySig();

    this.loadingSig.set(true);
    try {
      const res: ItemsPageResponseDto = await firstValueFrom(this.api.page(query));
      this.itemsSig.set(Array.isArray(res.items) ? res.items : []);
      this.totalSig.set(Number(res.total || 0));
      this.totalPagesSig.set(Number(res.totalPages || 1));
    } finally {
      this.loadingSig.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  // -----------------------------
  // CRUD (admin)
  // -----------------------------
  async create(payload: CreateItemPayload): Promise<ItemDto> {
    this.actionSig.set('saving');
    try {
      const created = await firstValueFrom(this.api.create(payload));
      // socket vai atualizar também, mas garantimos aqui
      this.itemsSig.update((list) => upsertById(list, created));
      return created;
    } finally {
      this.actionSig.set('idle');
    }
  }

  async update(id: number, payload: UpdateItemPayload): Promise<ItemDto> {
    this.actionSig.set('saving');
    try {
      const updated = await firstValueFrom(this.api.update(id, payload));
      this.itemsSig.update((list) => upsertById(list, updated));
      return updated;
    } finally {
      this.actionSig.set('idle');
    }
  }

  async remove(id: number): Promise<void> {
    this.actionSig.set('deleting');
    try {
      await firstValueFrom(this.api.remove(id));
      this.itemsSig.update((list) => removeById(list, id));
    } finally {
      this.actionSig.set('idle');
    }
  }

  private computeTotalPages(total: number, pageSize: number) {
    const ps = Math.max(1, Math.trunc(pageSize || 25));
    return Math.max(1, Math.ceil((total || 0) / ps));
  }
}
