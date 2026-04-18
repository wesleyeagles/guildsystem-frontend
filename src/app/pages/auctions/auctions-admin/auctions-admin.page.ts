import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import {
  AuctionCatalogItem,
  AuctionItemCatalogService,
  AuctionItemRef,
} from '../../../services/auction-item-catalog.service';

import { AuctionItemPickerComponent } from '../../../components/auction-item-picker/auction-item-picker.component';
import { AuctionsPagerComponent } from '../components/auctions-pager/auctions-pager.component';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { AuctionCard, AuctionsApi, CreateAuctionDto, UpdateAuctionDto } from '../../../api/auctions.api';

import { AuctionsSocketService } from '../../../services/auctions-socket.service';

import { ITEM_CATEGORIES, type ItemCategory } from '../../../api/items.api';

type UiType = ItemCategory;
type CatKey = ItemCategory;

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

function normalizeImgSrc(src: string | null | undefined) {
  const s = asStr(src);
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;

  const base = environment.apiUrl.replace(/\/$/, '');
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

function legacyTypeToCategory(t: string | null | undefined): ItemCategory | null {
  const s = asStr(t).toLowerCase();
  if (!s) return null;

  // legacy do seu catálogo antigo
  if (s === 'weapon') return 'Weapon';
  if (s === 'armor') return 'Armor';
  if (s === 'accessory') return 'Accessory';
  if (s === 'resource') return 'Resource';

  const found = (ITEM_CATEGORIES as readonly string[]).find((x) => x.toLowerCase() === s);
  return (found as ItemCategory) ?? null;
}

@Component({
  selector: 'app-auctions-admin-page',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, AuctionItemPickerComponent, AuctionsPagerComponent, UiSpinnerComponent],
  templateUrl: './auctions-admin.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsAdminPage {
  private api = inject(AuctionsApi);
  private socket = inject(AuctionsSocketService);
  private catalog = inject(AuctionItemCatalogService);
  private destroyRef = inject(DestroyRef);

  readonly pageSizes = [12, 20, 30, 50, 150, 200] as const;

  auctions = signal<AuctionCard[]>([]);
  loadingAuctions = signal<boolean>(false);

  rowErrorById = signal<Record<number, string>>({});

  total = signal(0);
  totalPages = signal(1);
  page = signal(1);
  pageSize = signal<number>(12);

  cat = signal<Record<CatKey, CatState>>({
    Weapon: { items: [], cursor: null, loading: false, q: '', loaded: false },
    Shield: { items: [], cursor: null, loading: false, q: '', loaded: false },
    Armor: { items: [], cursor: null, loading: false, q: '', loaded: false },
    Accessory: { items: [], cursor: null, loading: false, q: '', loaded: false },
    Resource: { items: [], cursor: null, loading: false, q: '', loaded: false },
    Booty: { items: [], cursor: null, loading: false, q: '', loaded: false },
  });

  private catIndex = new Map<string, AuctionCatalogItem>();
  private catSearch$ = new Map<CatKey, Subject<string>>();

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
    itemRef: AuctionItemRef | null;
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
    this.initCatalogSearchPipelines();

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
    return this.catalog.byCategory(key, q, cursor, 60);
  }

  private initCatalogSearchPipelines() {
    const keys: CatKey[] = ['Weapon', 'Shield', 'Armor', 'Accessory', 'Resource', 'Booty'];

    for (const key of keys) {
      const subj = new Subject<string>();
      this.catSearch$.set(key, subj);

      subj
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          tap((q) => {
            const query = asStr(q);
            this.patchCat(key, { loading: true, cursor: null, loaded: false, q: query });
          }),
          switchMap((q) => {
            const query = asStr(q);
            return this.fetchCatalog(key, query, null).pipe(
              catchError(() => of({ items: [], nextCursor: null } as any)),
              finalize(() => this.patchCat(key, { loading: false, loaded: true })),
            );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((res: any) => {
          const items = (res?.items ?? []) as AuctionCatalogItem[];
          this.patchCat(key, { items, cursor: res?.nextCursor ?? null });
          this.addToIndex(items);
        });
    }
  }

  ensureCatalogLoadedForCurrentType(forceReset = false) {
    const key = this.form().type;
    const st = this.cat()[key];
    if (!forceReset && st.loaded && st.items.length) return;
    this.searchCatalog('');
  }

  searchCatalog(q: string) {
    const key = this.form().type;
    const query = String(q ?? '');

    this.patchCat(key, { q: query });
    this.catSearch$.get(key)!.next(query);
  }

  loadMoreCatalog() {
    const key = this.form().type;
    const st = this.cat()[key];
    if (st.loading) return;
    if (!st.cursor) return;

    this.patchCat(key, { loading: true });

    this.fetchCatalog(key, asStr(st.q), st.cursor).subscribe({
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
      error: () => this.patchCat(key, { loading: false }),
    });
  }

  currentCatalogItems = computed(() => {
    const key = this.form().type;
    return this.cat()[key].items;
  });

  currentCatalogLoading = computed(() => {
    const key = this.form().type;
    return this.cat()[key].loading;
  });

  currentCatalogHasMore = computed(() => {
    const key = this.form().type;
    return Boolean(this.cat()[key].cursor);
  });

  currentCatalogSearch = computed(() => {
    const key = this.form().type;
    return this.cat()[key].q;
  });

  // ======================
  // Display helpers
  // ======================
  private findInIndex(ref: AuctionItemRef | null) {
    if (!ref) return null;
    const k = `${ref.itemType}:${ref.itemId}:${(ref as any).slot ?? ''}`;
    return this.catIndex.get(k) ?? null;
  }

  private normalizeAuctionItemType(raw: any): ItemCategory | null {
    return legacyTypeToCategory(raw);
  }

  displayItem(a: AuctionCard) {
    const itemTypeRaw = (a as any).itemType as string | undefined;
    const itemId = toInt((a as any).itemId);

    const cat = this.normalizeAuctionItemType(itemTypeRaw);
    if (!cat || !itemId) return null;

    return this.findInIndex({ itemType: cat, itemId, slot: undefined });
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

    this.ensureCatalogLoadedForCurrentType(false);
  }

  openEdit(a: AuctionCard) {
    this.modalError.set(null);

    const itemId = toInt((a as any).itemId);
    const cat = this.normalizeAuctionItemType((a as any).itemType);

    const itemRef: AuctionItemRef | null =
      cat && itemId
        ? {
          itemType: cat,
          itemId,
          slot: undefined,
        }
        : null;

    const type: UiType = (cat ?? 'Weapon') as UiType;

    this.form.set({
      title: (a as any).title,
      itemRef,
      type,
      durationHours: 24,
      testMinutes: 0,
      startsAt: shortIso(new Date((a as any).startsAt)),
    });

    // garante que o selecionado exista no index
    if (itemRef) {
      const existing = this.findInIndex(itemRef);
      if (!existing) {
        const synthetic: AuctionCatalogItem = {
          itemType: itemRef.itemType,
          itemId: itemRef.itemId,
          name: asStr((a as any).itemName || 'Item'),
          label: 'Selecionado',
          imagePath: (a as any).itemImagePath ?? null,

          // ✅ mantém o que vier (string[] OU {label,value}[])
          effects: (a as any).itemEffects ?? [],

          slot: null,
          level: null,
          gradeName: null,
        };

        this.addToIndex([synthetic]);

        const key = type;
        const st = this.cat()[key];
        if (!st.items.find((x) => x.itemId === synthetic.itemId && x.itemType === synthetic.itemType)) {
          this.patchCat(key, { items: [synthetic, ...st.items] });
        }
      }
    }

    this.modal.set({ open: true, mode: 'edit', title: 'Editar leilão', auction: a });

    this.ensureCatalogLoadedForCurrentType(false);
  }

  onTypeChange(t: UiType) {
    this.setForm({ type: t, itemRef: null });
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

    // ✅ AQUI: se catálogo vier string[], salva string[]
    const rawFx = (selected as any).effects;

    const effects =
      Array.isArray((selected as any).specialEffects)
        ? ((selected as any).specialEffects as any[])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
        : null;

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
        itemName: selected.name,
        itemImagePath: selected.imagePath,
        itemEffects: effects,
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
