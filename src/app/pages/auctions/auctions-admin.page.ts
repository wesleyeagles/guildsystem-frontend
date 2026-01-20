// src/app/pages/auctions/auctions-admin.page.ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  AuctionsApi,
  type AuctionCard,
  type CreateAuctionDto,
  type UpdateAuctionDto,
} from '../../api/auctions.api';

import { AuctionsSocketService } from '../../services/auctions-socket.service';
import {
  AuctionItemCatalogService,
  type AuctionCatalogItem,
  type AuctionItemRef,
  type AuctionItemRef as AuctionItemRefType,
} from '../../services/auction-item-catalog.service';

import { AuctionItemPickerComponent } from '../../components/auction-item-picker/auction-item-picker.component';
import { API_BASE } from '../../api/auctions.api';
import { AuctionsPagerComponent } from './components/auctions-pager/auctions-pager.component';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';

type UiType = 'Weapon' | 'Armor' | 'Accessory';
type CatKey = 'weapon' | 'armor' | 'accessory';

const BR_TZ = 'America/Sao_Paulo';

function parseMs(iso: string | null | undefined) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function shortIso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function asStr(v: any) {
  return String(v ?? '').trim();
}

function mapUiTypeToItemType(t: UiType): CatKey {
  if (t === 'Weapon') return 'weapon';
  if (t === 'Armor') return 'armor';
  return 'accessory';
}

function normalizeImgSrc(src: string | null | undefined) {
  const s = asStr(src);
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;

  const base = API_BASE.replace(/\/$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${base}${path}`;
}

function formatBRDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

type CatState = {
  items: AuctionCatalogItem[];
  cursor: string | null;
  loading: boolean;
  q: string;
  loaded: boolean;
};

@Component({
  selector: 'app-auctions-admin-page',
  standalone: true,
  imports: [CommonModule, AuctionItemPickerComponent, AuctionsPagerComponent, UiSpinnerComponent],
  templateUrl: './auctions-admin.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsAdminPage {
  private api = inject(AuctionsApi);
  private socket = inject(AuctionsSocketService);
  private catalog = inject(AuctionItemCatalogService);
  private destroyRef = inject(DestroyRef);

  readonly pageSizes = [12, 20, 30, 50, 100, 200] as const;

  auctions = signal<AuctionCard[]>([]);
  loadingAuctions = signal<boolean>(false);

  rowErrorById = signal<Record<number, string>>({});

  total = signal(0);
  totalPages = signal(1);
  page = signal(1);
  pageSize = signal<number>(12);

  // ✅ Catálogo agora é POR TIPO e paginado
  cat = signal<Record<CatKey, CatState>>({
    weapon: { items: [], cursor: null, loading: false, q: '', loaded: false },
    armor: { items: [], cursor: null, loading: false, q: '', loaded: false },
    accessory: { items: [], cursor: null, loading: false, q: '', loaded: false },
  });

  // para resolver displayItem sem baixar 19k
  private catIndex = new Map<string, AuctionCatalogItem>();

  auctionsSorted = computed(() =>
    this.auctions()
      .slice()
      .sort((x, y) => parseMs(y.createdAt) - parseMs(x.createdAt)),
  );

  modal = signal<{
    open: boolean;
    mode: 'create' | 'edit' | 'extend' | 'cancel' | 'delete';
    title: string;
    auction: AuctionCard | null;
  }>({ open: false, mode: 'create', title: 'Leilão', auction: null });

  modalError = signal<string | null>(null);

  form = signal<{
    title: string;
    itemRef: AuctionItemRefType | null;
    type: UiType;
    durationHours: number;
    testMinutes: number;
    startsAt: string;
  }>({
    title: 'Leilão',
    itemRef: null,
    type: 'Weapon',
    durationHours: 24,
    testMinutes: 0,
    startsAt: '',
  });

  extendSeconds = signal<number>(30);
  cancelReason = signal<string>('');

  private pointerDownOnBackdrop = false;

  constructor() {
    this.reload();

    this.socket.connect();

    this.socket
      .onAuctionCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    this.socket
      .onAuctionUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    this.socket
      .onAuctionDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());
  }

  // ======================
  // Paging
  // ======================
  onChangePageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    this.reload();
  }

  prevPage() {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    this.reload();
  }

  nextPage() {
    if (this.page() >= this.totalPages()) return;
    this.page.set(this.page() + 1);
    this.reload();
  }

  reload() {
    this.loadingAuctions.set(true);

    this.api.adminListPage({ group: 'all', page: this.page(), pageSize: this.pageSize() }).subscribe({
      next: (res) => {
        this.auctions.set(res.items);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.page.set(res.page);
      },
      error: () => { },
      complete: () => this.loadingAuctions.set(false),
    });
  }

  // ======================
  // Catálogo (paginado por tipo)
  // ======================
  private patchCat(key: CatKey, patch: Partial<CatState>) {
    const cur = this.cat();
    this.cat.set({ ...cur, [key]: { ...cur[key], ...patch } });
  }

  private addToIndex(items: AuctionCatalogItem[]) {
    for (const it of items) {
      const k = `${it.itemType}:${it.itemId}:${(it as any).slot ?? ''}`;
      this.catIndex.set(k, it);
    }
  }

  private fetchCatalog(key: CatKey, q: string, cursor: string | null) {
    if (key === 'weapon') return this.catalog.weapons(q, cursor, 60);
    if (key === 'armor') return this.catalog.armors(q, cursor, 60);
    return this.catalog.accessories(q, cursor, 60);
  }

  ensureCatalogLoadedForCurrentType(forceReset = false) {
    const key = mapUiTypeToItemType(this.form().type);
    const st = this.cat()[key];
    if (!forceReset && st.loaded && st.items.length) return;
    this.searchCatalog(''); // reset busca e carrega primeira página
  }

  searchCatalog(q: string) {
    const key = mapUiTypeToItemType(this.form().type);
    const st = this.cat()[key];

    const query = asStr(q);
    // evita spam
    if (st.loading) return;

    this.patchCat(key, { loading: true, q: query, cursor: null });

    this.fetchCatalog(key, query, null).subscribe({
      next: (res) => {
        const items = (res?.items ?? []) as AuctionCatalogItem[];
        this.patchCat(key, {
          items,
          cursor: res?.nextCursor ?? null,
          loading: false,
          loaded: true,
        });
        this.addToIndex(items);
      },
      error: () => {
        this.patchCat(key, { items: [], cursor: null, loading: false, loaded: true });
      },
    });
  }

  loadMoreCatalog() {
    const key = mapUiTypeToItemType(this.form().type);
    const st = this.cat()[key];
    if (st.loading) return;
    if (!st.cursor) return;

    this.patchCat(key, { loading: true });

    this.fetchCatalog(key, st.q, st.cursor).subscribe({
      next: (res) => {
        const more = (res?.items ?? []) as AuctionCatalogItem[];
        const merged = [...st.items, ...more];

        this.patchCat(key, {
          items: merged,
          cursor: res?.nextCursor ?? null,
          loading: false,
          loaded: true,
        });

        this.addToIndex(more);
      },
      error: () => {
        this.patchCat(key, { loading: false });
      },
    });
  }

  // usado pelo picker
  currentCatalogItems = computed(() => {
    const key = mapUiTypeToItemType(this.form().type);
    return this.cat()[key].items;
  });

  currentCatalogLoading = computed(() => {
    const key = mapUiTypeToItemType(this.form().type);
    return this.cat()[key].loading;
  });

  currentCatalogHasMore = computed(() => {
    const key = mapUiTypeToItemType(this.form().type);
    return Boolean(this.cat()[key].cursor);
  });

  currentCatalogSearch = computed(() => {
    const key = mapUiTypeToItemType(this.form().type);
    return this.cat()[key].q;
  });

  // ======================
  // Display helpers (sem loadAll)
  // ======================
  private findInIndex(ref: AuctionItemRef | null) {
    if (!ref) return null;
    const k = `${ref.itemType}:${ref.itemId}:${(ref as any).slot ?? ''}`;
    return this.catIndex.get(k) ?? null;
  }

  displayItem(a: AuctionCard) {
    const itemType = (a as any).itemType as CatKey | undefined;
    const itemId = toInt((a as any).itemId);
    if (!itemType || !itemId) return null;
    return this.findInIndex({ itemType, itemId, slot: undefined });
  }

  displayImage(a: AuctionCard) {
    const fromCatalog = this.displayItem(a)?.imagePath ?? null;
    const raw = fromCatalog || ((a as any).itemImagePath as any);
    return normalizeImgSrc(raw);
  }

  displayItemName(a: AuctionCard) {
    const fromCatalog = this.displayItem(a)?.name;
    return asStr(fromCatalog || (a as any).itemName || '—');
  }

  brStartsAt(a: AuctionCard | null | undefined) {
    return formatBRDateTime((a as any)?.startsAt);
  }

  brEndsAt(a: AuctionCard | null | undefined) {
    return formatBRDateTime((a as any)?.endsAt);
  }

  // ======================
  // Modal
  // ======================
  onBackdropPointerDown(_e: PointerEvent) {
    this.pointerDownOnBackdrop = true;
  }

  onBackdropPointerUp(_e: PointerEvent) {
    if (this.pointerDownOnBackdrop) this.closeModal();
    this.pointerDownOnBackdrop = false;
  }

  openCreate() {
    this.modalError.set(null);

    this.form.set({
      title: 'Leilão',
      itemRef: null,
      type: 'Weapon',
      durationHours: 24,
      testMinutes: 0,
      startsAt: '',
    });

    this.modal.set({ open: true, mode: 'create', title: 'Criar leilão', auction: null });

    // ✅ carrega só o necessário (primeira página do tipo)
    this.ensureCatalogLoadedForCurrentType(false);
  }

  openEdit(a: AuctionCard) {
    this.modalError.set(null);

    const itemRef: AuctionItemRef | null =
      (a as any).itemType && (a as any).itemId
        ? {
          itemType: (a as any).itemType as any,
          itemId: toInt((a as any).itemId),
          slot: undefined,
        }
        : null;

    const type: UiType =
      (a as any).itemType === 'armor'
        ? 'Armor'
        : (a as any).itemType === 'accessory'
          ? 'Accessory'
          : 'Weapon';

    this.form.set({
      title: (a as any).title,
      itemRef,
      type,
      durationHours: 24,
      testMinutes: 0,
      startsAt: shortIso(new Date((a as any).startsAt)),
    });

    // ✅ garante que o item atual esteja no index (mesmo sem estar no page carregado)
    if (itemRef) {
      const existing = this.findInIndex(itemRef);
      if (!existing) {
        const synthetic: AuctionCatalogItem = {
          itemType: itemRef.itemType as any,
          itemId: itemRef.itemId,
          name: asStr((a as any).itemName || 'Item'),
          label: 'Selecionado',
          imagePath: (a as any).itemImagePath ?? null,
          effects: [],
        };
        this.addToIndex([synthetic]);

        const key = mapUiTypeToItemType(type);
        const st = this.cat()[key];
        if (!st.items.find((x) => x.itemId === synthetic.itemId && x.itemType === synthetic.itemType)) {
          this.patchCat(key, { items: [synthetic, ...st.items] });
        }
      }
    }

    this.modal.set({ open: true, mode: 'edit', title: 'Editar leilão', auction: a });

    // ✅ carrega página 1 do tipo (não trava modal)
    this.ensureCatalogLoadedForCurrentType(false);
  }

  onTypeChange(t: UiType) {
    this.setForm({ type: t, itemRef: null });
    // ✅ ao trocar o tipo, busca a primeira página desse tipo
    this.searchCatalog('');
  }

  openExtend(a: AuctionCard) {
    this.modalError.set(null);
    this.extendSeconds.set(30);
    this.modal.set({ open: true, mode: 'extend', title: 'Estender leilão', auction: a });
  }

  openCancel(a: AuctionCard) {
    this.modalError.set(null);
    this.cancelReason.set('');
    this.modal.set({ open: true, mode: 'cancel', title: 'Cancelar leilão', auction: a });
  }

  openDelete(a: AuctionCard) {
    this.modalError.set(null);
    this.modal.set({ open: true, mode: 'delete', title: 'Delete hard', auction: a });
  }

  closeModal() {
    this.modal.set({ open: false, mode: 'create', title: '', auction: null });
    this.modalError.set(null);
    this.pointerDownOnBackdrop = false;
  }

  setForm(patch: Partial<ReturnType<AuctionsAdminPage['form']>>) {
    this.form.set({ ...this.form(), ...patch });
  }

  saveCreateOrEdit() {
    this.modalError.set(null);

    const m = this.modal();
    const f = this.form();



    if (!asStr(f.title)) return this.modalError.set('Título é obrigatório');
    if (!f.itemRef) return this.modalError.set('Selecione um item');

    const selected = this.findInIndex(f.itemRef);
    if (!selected) return this.modalError.set('Item selecionado não encontrado (tente buscar pelo nome)');


    const effects =
      Array.isArray((selected as any).effects)
        ? ((selected as any).effects as any[])
          .map((e) => ({ label: asStr(e?.label), value: Number(e?.value) }))
          .filter((e) => e.label && Number.isFinite(e.value) && e.value !== 0)
        : [];

    if (m.mode === 'create') {
      const hours = Number(f.durationHours);
      const tm = Number(f.testMinutes);

      let durationSeconds = 0;

      if (Number.isFinite(tm) && tm > 0) {
        durationSeconds = Math.trunc(tm * 60);
      } else {
        if (!Number.isFinite(hours) || hours < 1) return this.modalError.set('Duração mínima: 1 hora');
        durationSeconds = Math.trunc(hours * 3600);
      }

      const dto: CreateAuctionDto = {
        title: asStr(f.title),
        itemType: selected.itemType,
        itemId: selected.itemId,
        itemEffects: effects.length ? effects : null,
        itemName: selected.name,
        itemImagePath: selected.imagePath,
        durationSeconds,
        startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined,
      };

      this.api.create(dto).subscribe({
        next: () => this.closeModal(),
        error: (e) => this.modalError.set(e?.error?.message ?? 'Erro ao criar'),
      });
      return;
    }

    if (m.mode === 'edit' && m.auction) {
      const dto: UpdateAuctionDto = {
        title: asStr(f.title),
        itemType: selected.itemType,
        itemId: selected.itemId,
        itemName: selected.name,
        itemImagePath: selected.imagePath,
      };

      this.api.update((m.auction as any).id, dto).subscribe({
        next: () => this.closeModal(),
        error: (e) => this.modalError.set(e?.error?.message ?? 'Erro ao editar'),
      });
    }
  }

  confirmExtend() {
    this.modalError.set(null);
    const a = this.modal().auction;
    if (!a) return;

    const sec = Number(this.extendSeconds());
    if (!Number.isFinite(sec) || sec <= 0) return this.modalError.set('Informe segundos > 0');

    const dto: UpdateAuctionDto = { extendSeconds: sec };

    this.api.update((a as any).id, dto).subscribe({
      next: () => this.closeModal(),
      error: (e) => this.modalError.set(e?.error?.message ?? 'Erro ao estender'),
    });
  }

  confirmCancel() {
    this.modalError.set(null);
    const a = this.modal().auction;
    if (!a) return;

    const reason = asStr(this.cancelReason()) || null;

    this.api.cancel((a as any).id, reason).subscribe({
      next: () => this.closeModal(),
      error: (e) => this.modalError.set(e?.error?.message ?? 'Erro ao cancelar'),
    });
  }

  confirmDelete() {
    this.modalError.set(null);
    const a = this.modal().auction;
    if (!a) return;

    this.api.hardDelete((a as any).id).subscribe({
      next: () => this.closeModal(),
      error: (e) => this.modalError.set(e?.error?.message ?? 'Erro ao deletar'),
    });
  }
}
