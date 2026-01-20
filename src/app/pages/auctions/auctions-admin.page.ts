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
  template: `
    <div class="p-4 max-w-6xl mx-auto space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">Admin · Leilões</h1>
          <p class="text-sm text-slate-300">
            Crie, edite, cancele ou delete leilões. Cancelar libera holds; delete é só quando não tem lances/holds.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
            (click)="reload()"
          >
            Recarregar
          </button>

          <button
            class="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-semibold disabled:opacity-50"
            (click)="openCreate()"
            [disabled]="catalogLoading()"
            title="Carrega o catálogo de itens antes"
          >
            + Criar leilão
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2 text-sm text-slate-400">
        Total: <b class="text-white">{{ auctions().length }}</b>
        · Ativos: <b class="text-white">{{ activeCount() }}</b>
        · Finalizados: <b class="text-white">{{ finishedCount() }}</b>

        <span class="mx-2 text-slate-600">|</span>

        @if (catalogLoading()) {
          <span>Carregando catálogo de itens...</span>
        } @else {
          <span>Catálogo: <b class="text-white">{{ catalogItems().length }}</b> itens</span>
        }
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        @for (a of auctionsSorted(); track a.id) {
          <div class="rounded-2xl bg-slate-950 border border-slate-800 p-4 space-y-3">
            <div class="flex gap-3">
              <div
                class="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center"
              >
                @if (displayImage(a)) {
                  <img [src]="displayImage(a)!" class="w-full h-full object-cover" />
                } @else {
                  <span class="text-slate-500 text-xs">no img</span>
                }
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-semibold truncate">{{ a.title }}</div>
                    <div class="text-xs text-slate-400 truncate">{{ displayItemName(a) }}</div>
                  </div>

                  <span class="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-xs">
                    {{ a.status }}
                  </span>
                </div>

                <div class="mt-2 text-sm">
                  Último lance:
                  <b class="text-white">{{ a.currentBidAmount }}</b>
                  @if (a.lastBidNickname) {
                    <span class="text-slate-400"> por </span>
                    <b class="text-white">{{ a.lastBidNickname }}</b>
                  }
                  @if (a.tieCount > 1) {
                    <span class="ml-2 text-amber-200 text-xs">Empate: {{ a.tieCount }}</span>
                  }
                </div>

                <div class="mt-1 text-xs text-slate-400">
                  Início: <b class="text-white">{{ brStartsAt(a) }}</b>
                  · Fim: <b class="text-white">{{ brEndsAt(a) }}</b>
                </div>

                @if (a.status === 'CANCELED') {
                  <div class="mt-2 text-xs text-rose-300">
                    Cancelado: {{ a.cancelReason || '—' }}
                  </div>
                }

                @if (a.status === 'FINISHED' && a.winnerNickname) {
                  <div class="mt-2 text-xs text-emerald-300">
                    Vencedor: <b>{{ a.winnerNickname }}</b> ({{ a.winningBidAmount || 0 }} pts)
                  </div>
                }
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
                (click)="openEdit(a)"
                [disabled]="catalogLoading()"
                title="Precisa do catálogo carregado"
              >
                Editar
              </button>

              <button
                class="px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-700/40 hover:bg-amber-900/30 text-amber-200 text-sm"
                (click)="openExtend(a)"
                [disabled]="a.status === 'CANCELED' || a.status === 'FINISHED'"
                title="Adiciona segundos no fim"
              >
                Estender
              </button>

              <button
                class="px-3 py-2 rounded-xl bg-rose-900/20 border border-rose-700/40 hover:bg-rose-900/30 text-rose-200 text-sm"
                (click)="openCancel(a)"
                [disabled]="a.status === 'CANCELED' || a.status === 'FINISHED'"
              >
                Cancelar
              </button>

              <button
                class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
                (click)="openDelete(a)"
                title="Só funciona se não tiver lances/holds. Caso contrário use cancelar."
              >
                Delete hard
              </button>
            </div>

            @if (rowErrorById()[a.id]) {
              <div class="text-xs text-rose-300">{{ rowErrorById()[a.id] }}</div>
            }
          </div>
        }
      </div>
    </div>

    <!-- MODAL -->
    @if (modal().open) {
      <div
        class="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
        (pointerdown)="onBackdropPointerDown($event)"
        (pointerup)="onBackdropPointerUp($event)"
      >
        <!-- ✅ sem overflow-hidden: dropdown do select não corta -->
        <div
          class="w-full max-w-4xl rounded-2xl bg-slate-950 border border-slate-800 overflow-visible"
          (pointerdown)="$event.stopPropagation()"
          (pointerup)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-800 rounded-t-2xl">
            <div class="font-semibold">{{ modal().title }}</div>
            <button
              class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
              (click)="closeModal()"
            >
              Fechar
            </button>
          </div>

          <div class="p-4 space-y-3">
            @if (modal().mode === 'create' || modal().mode === 'edit') {
              <div class="grid grid-cols-1 gap-3">
                <label class="space-y-1">
                  <div class="text-xs text-slate-400">Título</div>
                  <input
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                    [value]="form().title"
                    (input)="setForm({ title: ($any($event.target).value || '') })"
                  />
                </label>

                <label class="space-y-1">
                  <div class="text-xs text-slate-400">Tipo de Item</div>
                  <select
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                    [value]="form().type"
                    (change)="onTypeChange(($any($event.target).value || 'Weapon'))"
                  >
                    <option value="Weapon">Weapon</option>
                    <option value="Armor">Armor</option>
                    <option value="Accessory">Accessories</option>
                  </select>
                </label>

                <app-auction-item-picker
                  [type]="form().type"
                  [items]="catalogByType()"
                  [selected]="form().itemRef"
                  (selectedChange)="setForm({ itemRef: $event })"
                />

                @if (modal().mode === 'create') {
                  <label class="space-y-1">
                    <div class="text-xs text-slate-400">Duração (horas)</div>
                    <input
                      class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                      type="number"
                      min="1"
                      step="1"
                      [value]="form().durationHours"
                      (input)="setForm({ durationHours: ($any($event.target).valueAsNumber || 0) })"
                      placeholder="Ex: 24"
                    />
                  </label>

                  <!-- ✅ TESTE RÁPIDO -->
                  <label class="space-y-1">
                    <div class="text-xs text-slate-400">Teste rápido (minutos)</div>
                    <input
                      class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                      type="number"
                      min="0"
                      step="1"
                      [value]="form().testMinutes"
                      (input)="setForm({ testMinutes: ($any($event.target).valueAsNumber || 0) })"
                      placeholder="0 = desativado"
                    />
                    <div class="text-xs text-slate-500">
                      Se > 0, sobrescreve a duração em horas (só pra testes).
                    </div>
                  </label>

                  <label class="space-y-1">
                    <div class="text-xs text-slate-400">Começa em (opcional)</div>
                    <input
                      class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                      type="datetime-local"
                      [value]="form().startsAt"
                      (input)="setForm({ startsAt: ($any($event.target).value || '') })"
                    />
                    <div class="text-xs text-slate-500">Se vazio, começa imediatamente.</div>
                  </label>
                } @else {
                  <div class="text-xs text-slate-500">
                    Edição: altere título e item. Duração use “Estender”.
                  </div>
                }
              </div>

              @if (modalError()) {
                <div class="text-xs text-rose-300">{{ modalError() }}</div>
              }

              <div class="flex justify-end gap-2 pt-2">
                <button
                  class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
                  (click)="closeModal()"
                >
                  Cancelar
                </button>
                <button
                  class="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm font-semibold"
                  (click)="saveCreateOrEdit()"
                >
                  Salvar
                </button>
              </div>
            }

            @if (modal().mode === 'extend') {
              <div class="space-y-2">
                <div class="text-sm text-slate-300">
                  Leilão: <b class="text-white">{{ modal().auction?.title }}</b>
                </div>
                <label class="space-y-1">
                  <div class="text-xs text-slate-400">Adicionar segundos</div>
                  <input
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                    type="number"
                    [value]="extendSeconds()"
                    (input)="extendSeconds.set($any($event.target).valueAsNumber || 0)"
                  />
                </label>

                @if (modalError()) {
                  <div class="text-xs text-rose-300">{{ modalError() }}</div>
                }

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
                    (click)="closeModal()"
                  >
                    Cancelar
                  </button>
                  <button
                    class="px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-700/40 hover:bg-amber-900/30 text-amber-200 text-sm font-semibold"
                    (click)="confirmExtend()"
                  >
                    Estender
                  </button>
                </div>
              </div>
            }

            @if (modal().mode === 'cancel') {
              <div class="space-y-2">
                <div class="text-sm text-slate-300">
                  Cancelar leilão: <b class="text-white">{{ modal().auction?.title }}</b>
                </div>

                <label class="space-y-1">
                  <div class="text-xs text-slate-400">Motivo</div>
                  <textarea
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm min-h-[90px]"
                    [value]="cancelReason()"
                    (input)="cancelReason.set(($any($event.target).value || ''))"
                  ></textarea>
                </label>

                @if (modalError()) {
                  <div class="text-xs text-rose-300">{{ modalError() }}</div>
                }

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
                    (click)="closeModal()"
                  >
                    Voltar
                  </button>
                  <button
                    class="px-3 py-2 rounded-xl bg-rose-900/20 border border-rose-700/40 hover:bg-rose-900/30 text-rose-200 text-sm font-semibold"
                    (click)="confirmCancel()"
                  >
                    Confirmar cancelamento
                  </button>
                </div>
              </div>
            }

            @if (modal().mode === 'delete') {
              <div class="space-y-2">
                <div class="text-sm text-slate-300">
                  Delete hard: <b class="text-white">{{ modal().auction?.title }}</b>
                </div>
                <div class="text-xs text-slate-400">
                  Só funciona se o leilão não tiver lances/holds. Se falhar, use <b class="text-white">Cancelar</b>.
                </div>

                @if (modalError()) {
                  <div class="text-xs text-rose-300">{{ modalError() }}</div>
                }

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
                    (click)="closeModal()"
                  >
                    Voltar
                  </button>
                  <button
                    class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm font-semibold"
                    (click)="confirmDelete()"
                  >
                    Deletar
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
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
    this.api.adminList().subscribe({ next: (list) => this.auctions.set(list), error: () => {} });
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
