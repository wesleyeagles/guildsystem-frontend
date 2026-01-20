import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';

import { API_BASE } from '../../api/auctions.api';
import {
  AuctionItemCatalogService,
  type AuctionCatalogItem,
  type AuctionItemRef,
  type AuctionCatalogEffect,
} from '../../services/auction-item-catalog.service';

type UnitKind = 'none' | 'percent' | 'ms' | 'string';

const EFFECT_UNIT_BY_LABEL: Record<string, UnitKind> = {
  'Max. SP': 'percent',
  'FP Consumption': 'percent',
  'Max. HP/FP': 'percent',
  Attack: 'percent',
  Defense: 'percent',
  'Level up skills by': 'none',
  Detect: 'none',
  Vampiric: 'percent',
  'Force Attack': 'percent',
  'Critical Chance': 'percent',
  'Block Chance': 'percent',
  'Max. HP': 'percent',
  'Max. FP': 'percent',
  'Debuff Duration': 'percent',
  'Ignore Block Chance': 'percent',
  'Movement Speed': 'none',
  'Launcher Attack Delay': 'ms',
  'Force Skill Delay': 'ms',
};

function asStr(v: any) {
  return String(v ?? '').trim();
}
function lower(s: string) {
  return asStr(s).toLowerCase();
}
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function normalizeImgSrc(src: string | null | undefined) {
  const s = asStr(src);
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;

  const base = API_BASE.replace(/\/$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${base}${path}`;
}
function unitKind(label: string): UnitKind {
  return EFFECT_UNIT_BY_LABEL[asStr(label)] ?? 'none';
}
function formatEffectValueFromCatalog(e: AuctionCatalogEffect): string {
  const label = asStr(e.label);
  const kind = unitKind(label);

  const value = toNum(e.value);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';

  if (kind === 'percent') {
    const v = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
    return `${sign}${v}%`;
  }
  if (kind === 'ms') {
    const v = String(Math.round(abs));
    return `${sign}${v}ms`;
  }
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  return `${sign}${abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
}
type EffectChip = { text: string };
function effectsChipsFromItem(it: AuctionCatalogItem): EffectChip[] {
  const fx = (it.effects ?? [])
    .filter((e) => asStr(e?.label) && toNum(e?.value) !== 0)
    .map((e) => {
      const label = asStr(e.label);
      const value = formatEffectValueFromCatalog(e);
      return { text: `${label} ${value}`.trim() };
    });

  const seen = new Set<string>();
  const out: EffectChip[] = [];
  for (const c of fx) {
    const k = lower(c.text);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

@Component({
  selector: 'app-auction-weapon-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-1">
      @if (label) { <div class="text-xs text-slate-400">{{ label }}</div> }

      <div class="relative" #root>
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm"
          (click)="toggle()"
        >
          @if (selectedItem()) {
            <div class="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
              @if (selectedImg()) {
                <img [src]="selectedImg()!" class="w-full h-full object-cover p-2" />
              } @else {
                <span class="text-[10px] text-slate-500">no img</span>
              }
            </div>

            <div class="min-w-0 flex-1 text-left">
              <div class="flex items-center gap-2 min-w-0">
                <div class="truncate font-semibold text-white">{{ selectedItem()!.name }}</div>

                @if (selectedChips().length) {
                  <div class="flex flex-wrap items-center gap-1 min-w-0">
                    @for (c of selectedChips(); track $index) {
                      <span class="shrink-0 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-950 text-[11px] text-slate-200">
                        {{ c.text }}
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="min-w-0 flex-1 text-left">
              <div class="text-slate-300">Selecione uma arma...</div>
            </div>
          }

          <div class="text-slate-400 text-xs shrink-0">
            @if (open()) { ▲ } @else { ▼ }
          </div>
        </button>

        @if (open()) {
          <div
            class="absolute z-[80] mt-2 w-full rounded-2xl bg-slate-950 border border-slate-800 shadow-xl overflow-hidden"
            (pointerdown)="$event.stopPropagation()"
          >
            <div class="p-2 border-b border-slate-800">
              <input
                #searchInput
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 outline-none focus:border-slate-600 text-sm"
                [value]="query()"
                (input)="onQueryInput($any($event.target).value || '')"
                placeholder="Pesquisar arma..."
              />

              <div class="mt-2 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  {{ itemsSig().length }} itens
                  @if (loading()) { <span class="text-slate-400">• carregando...</span> }
                </span>

                <button
                  type="button"
                  class="text-slate-300 hover:text-white disabled:opacity-50"
                  (click)="clear()"
                  [disabled]="!selectedRef()"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div class="max-h-[320px] overflow-auto p-2 space-y-1">
              @for (it of itemsSig(); track keyOf(it)) {
                <button
                  type="button"
                  class="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 text-left"
                  (click)="choose(it)"
                >
                  <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    @if (imgOf(it)) { <img [src]="imgOf(it)!" class="w-full h-full object-cover" /> }
                    @else { <span class="text-[10px] text-slate-500">no img</span> }
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="truncate font-semibold text-white">{{ it.name }}</div>

                      @if (chipsAll(it).length) {
                        <div class="flex flex-wrap items-center gap-1 min-w-0">
                          @for (c of chipsAll(it); track $index) {
                            <span class="shrink-0 px-2 py-0.5 mt-2 rounded-full border border-slate-700 bg-slate-950 text-[11px] text-slate-200">
                              {{ c.text }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  @if (isSelected(it)) {
                    <div class="text-emerald-300 text-xs font-semibold shrink-0">✓</div>
                  }
                </button>
              }

              @if (itemsSig().length === 0 && !loading()) {
                <div class="p-3 text-sm text-slate-400">Nada encontrado.</div>
              }

              @if (hasMore()) {
                <div class="pt-2">
                  <button
                    type="button"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sm disabled:opacity-50"
                    (click)="loadMore()"
                    [disabled]="loading()"
                  >
                    Carregar mais
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>

      @if (hint) { <div class="text-xs text-slate-500">{{ hint }}</div> }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionWeaponSelectComponent {
  private catalog = inject(AuctionItemCatalogService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  // ✅ controlado pelo pai
  selectedRef = signal<AuctionItemRef | null>(null);
  @Input() set selected(v: AuctionItemRef | null) { this.selectedRef.set(v ?? null); }
  get selected() { return this.selectedRef(); }

  @Input() label = 'Arma';
  @Input() hint = '';

  @Output() selectedChange = new EventEmitter<AuctionItemRef | null>();

  open = signal(false);
  query = signal('');

  itemsSig = signal<AuctionCatalogItem[]>([]);
  cursor = signal<string | null>(null);
  hasMore = signal(false);
  loading = signal(false);

  private query$ = new Subject<string>();

  constructor() {
    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        filter(() => this.open()), // só busca com dropdown aberto
        tap(() => {
          this.loading.set(true);
          this.cursor.set(null);
          this.hasMore.set(false);
        }),
        switchMap((q) => this.catalog.weapons(q, null, 60)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.itemsSig.set(res.items ?? []);
          this.cursor.set(res.nextCursor ?? null);
          this.hasMore.set(Boolean(res.nextCursor));
          this.loading.set(false);
        },
        error: () => {
          this.itemsSig.set([]);
          this.cursor.set(null);
          this.hasMore.set(false);
          this.loading.set(false);
        },
      });

    // quando abrir, carrega base
    effect(() => {
      if (!this.open()) return;
      this.ensureInitialLoaded();
    });
  }

  private ensureInitialLoaded() {
    if (this.itemsSig().length) return;
    this.loading.set(true);
    this.catalog.weapons('', null, 60).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.itemsSig.set(res.items ?? []);
        this.cursor.set(res.nextCursor ?? null);
        this.hasMore.set(Boolean(res.nextCursor));
        this.loading.set(false);
      },
      error: () => {
        this.itemsSig.set([]);
        this.cursor.set(null);
        this.hasMore.set(false);
        this.loading.set(false);
      },
    });
  }

  onQueryInput(v: string) {
    this.query.set(v);
    this.query$.next(v);
  }

  loadMore() {
    if (this.loading()) return;
    const cur = this.cursor();
    if (!cur) return;

    this.loading.set(true);
    this.catalog.weapons(this.query(), cur, 60).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.itemsSig.set([...this.itemsSig(), ...(res.items ?? [])]);
        this.cursor.set(res.nextCursor ?? null);
        this.hasMore.set(Boolean(res.nextCursor));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  selectedItem = computed(() => {
    const sel = this.selectedRef();
    if (!sel) return null;

    const id = Number(sel.itemId);
    const arr = this.itemsSig();
    return arr.find((x) => x.itemType === 'weapon' && x.itemId === id) ?? null;
  });

  selectedImg = computed(() => normalizeImgSrc(this.selectedItem()?.imagePath ?? null));
  selectedChips = computed(() => {
    const it = this.selectedItem();
    return it ? effectsChipsFromItem(it) : [];
  });

  chipsAll(it: AuctionCatalogItem): EffectChip[] {
    return effectsChipsFromItem(it);
  }

  imgOf(it: AuctionCatalogItem) {
    return normalizeImgSrc(it.imagePath);
  }

  toggle() {
    this.open.set(!this.open());
    if (this.open()) setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 0);
  }

  close() {
    this.open.set(false);
    this.query.set('');
    // não limpa items pra aproveitar cache local enquanto a página existir
  }

  clear() {
    this.selectedRef.set(null);
    this.selectedChange.emit(null);
    this.close();
  }

  choose(it: AuctionCatalogItem) {
    const ref: AuctionItemRef = { itemType: it.itemType, itemId: it.itemId, slot: it.slot };
    this.selectedRef.set(ref);
    this.selectedChange.emit(ref);
    this.close();
  }

  isSelected(it: AuctionCatalogItem) {
    const sel = this.selectedRef();
    if (!sel) return false;
    return sel.itemType === it.itemType && Number(sel.itemId) === it.itemId && (sel.slot ?? '') === (it.slot ?? '');
  }

  keyOf(it: AuctionCatalogItem) {
    return `${it.itemType}:${it.slot ?? ''}:${it.itemId}`;
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.open()) return;
    const root = this.rootRef?.nativeElement;
    const target = ev.target as Node | null;
    if (!root || !target) return;
    if (!root.contains(target)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open()) this.close();
  }
}
