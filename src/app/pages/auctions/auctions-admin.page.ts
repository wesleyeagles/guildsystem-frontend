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

type UiType = 'Weapon' | 'Armor' | 'Accessory';

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

function mapUiTypeToItemType(t: UiType): 'weapon' | 'armor' | 'accessory' {
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

// ✅ sempre Brasília
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

@Component({
  selector: 'app-auctions-admin-page',
  standalone: true,
  imports: [CommonModule, AuctionItemPickerComponent],
  template: `...`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsAdminPage {
  private api = inject(AuctionsApi);
  private socket = inject(AuctionsSocketService);
  private catalog = inject(AuctionItemCatalogService);
  private destroyRef = inject(DestroyRef);

  auctions = signal<AuctionCard[]>([]);
  rowErrorById = signal<Record<number, string>>({});

  catalogItems = signal<AuctionCatalogItem[]>([]);
  catalogLoading = signal<boolean>(true);

  activeCount = computed(
    () => this.auctions().filter((a) => a.status !== 'FINISHED' && a.status !== 'CANCELED').length,
  );
  finishedCount = computed(
    () => this.auctions().filter((a) => a.status === 'FINISHED' || a.status === 'CANCELED').length,
  );

  auctionsSorted = computed(() =>
    this.auctions()
      .slice()
      .sort((x, y) => parseMs(y.createdAt) - parseMs(x.createdAt)),
  );

  catalogByType = computed(() => {
    const t = this.form().type;
    const want = mapUiTypeToItemType(t);
    return this.catalogItems().filter((x) => x.itemType === want);
  });

  modal = signal<{
    open: boolean;
    mode: 'create' | 'edit' | 'extend' | 'cancel' | 'delete';
    title: string;
    auction: AuctionCard | null;
  }>({ open: false, mode: 'create', title: '', auction: null });

  modalError = signal<string | null>(null);

  form = signal<{
    title: string;
    itemRef: AuctionItemRefType | null;
    type: UiType;
    durationHours: number;
    testMinutes: number;
    startsAt: string;
  }>({
    title: '',
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

    this.catalog.loadAll(false).subscribe({
      next: (items) => {
        this.catalogItems.set(items);
        this.catalogLoading.set(false);
      },
      error: () => {
        this.catalogItems.set([]);
        this.catalogLoading.set(false);
      },
    });

    this.socket.connect();

    this.socket
      .onAuctionCreated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => this.upsert(a));

    this.socket
      .onAuctionUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((a) => this.upsert(a));

    this.socket
      .onAuctionDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => this.auctions.set(this.auctions().filter((x) => x.id !== p.id)));
  }

  displayItem(a: AuctionCard) {
    const itemType = (a as any).itemType as 'weapon' | 'armor' | 'accessory' | undefined;
    const itemId = toInt((a as any).itemId);
    if (!itemType || !itemId) return null;
    const found = this.catalog.find({ itemType, itemId, slot: undefined });
    return found;
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

  brStartsAt(a: AuctionCard) {
    return formatBRDateTime((a as any).startsAt);
  }

  brEndsAt(a: AuctionCard) {
    return formatBRDateTime((a as any).endsAt);
  }

  onBackdropPointerDown(_e: PointerEvent) {
    this.pointerDownOnBackdrop = true;
  }

  onBackdropPointerUp(_e: PointerEvent) {
    if (this.pointerDownOnBackdrop) this.closeModal();
    this.pointerDownOnBackdrop = false;
  }

  reload() {
    this.api.adminList().subscribe({ next: (list) => this.auctions.set(list), error: () => { } });
  }

  openCreate() {
    this.modalError.set(null);
    this.form.set({
      title: '',
      itemRef: null,
      type: 'Weapon',
      durationHours: 24,
      testMinutes: 0,
      startsAt: '',
    });
    this.modal.set({ open: true, mode: 'create', title: 'Criar leilão', auction: null });
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
      (a as any).itemType === 'armor' ? 'Armor' : (a as any).itemType === 'accessory' ? 'Accessory' : 'Weapon';

    this.form.set({
      title: (a as any).title,
      itemRef,
      type,
      durationHours: 24,
      testMinutes: 0,
      startsAt: shortIso(new Date((a as any).startsAt)),
    });

    this.modal.set({ open: true, mode: 'edit', title: 'Editar leilão', auction: a });
  }

  onTypeChange(t: UiType) {
    this.setForm({ type: t, itemRef: null });
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

    const selected = this.catalog.find(f.itemRef);
    if (!selected) return this.modalError.set('Item selecionado não encontrado no catálogo (recarregue)');

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

  private upsert(a: AuctionCard) {
    const list = this.auctions();
    const idx = list.findIndex((x: any) => (x as any).id === (a as any).id);
    if (idx === -1) {
      this.auctions.set([a, ...list]);
      return;
    }
    const next = list.slice();
    next[idx] = { ...(next[idx] as any), ...(a as any) };
    this.auctions.set(next);
  }
}
