// src/app/components/auction-item-select/auction-item-select.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { API_BASE } from '../../api/auctions.api';

import type {
  AuctionCatalogItem,
  AuctionItemRef,
} from '../../services/auction-item-catalog.service';

type UiType = 'Weapon' | 'Armor' | 'Accessory';
type UnitKind = 'none' | 'percent' | 'ms';

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

function mapUiTypeToItemType(t: UiType): 'weapon' | 'armor' | 'accessory' {
  if (t === 'Weapon') return 'weapon';
  if (t === 'Armor') return 'armor';
  return 'accessory';
}

function unitKind(label: string): UnitKind {
  return EFFECT_UNIT_BY_LABEL[asStr(label)] ?? 'none';
}

function formatEffectValue(label: string, valueRaw: any): string {
  const kind = unitKind(label);
  const value = toNum(valueRaw);
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';

  if (kind === 'percent') {
    const v = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.00$/, '');
    return `${sign}${v}%`;
  }
  if (kind === 'ms') return `${sign}${String(Math.round(abs))}ms`;
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  return `${sign}${abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
}

type EffectChip = { text: string };

function chipsFromItem(it: AuctionCatalogItem | null): EffectChip[] {
  if (!it) return [];

  const fx = (it.effects ?? [])
    .filter((e: any) => asStr(e?.label) && toNum(e?.value) !== 0)
    .map((e: any) => {
      const label = asStr(e.label);
      const val = formatEffectValue(label, e.value);
      return { text: `${label} ${val}`.trim() };
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
  selector: 'app-auction-item-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-1">
      @if (label) {
        <div class="text-xs text-slate-400">{{ label }}</div>
      }

      <div class="relative" #root>
        <!-- trigger -->
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

              <div class="truncate text-xs text-slate-400">{{ selectedItem()!.label }}</div>
            </div>
          } @else {
            <div class="min-w-0 flex-1 text-left">
              <div class="text-slate-300">Selecione um item...</div>
              <div class="text-xs text-slate-500">{{ type }}</div>
            </div>
          }

          <div class="text-slate-400 text-xs shrink-0">
            @if (open()) { ▲ } @else { ▼ }
          </div>
        </button>

        <!-- dropdown -->
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
                (input)="query.set(($any($event.target).value || ''))"
                placeholder="Pesquisar item..."
              />
              <div class="mt-2 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>{{ filtered().length }} itens</span>
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

            <div class="max-h-[340px] overflow-auto p-2 space-y-1">
              @for (it of filtered(); track keyOf(it)) {
                <button
                  type="button"
                  class="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 text-left"
                  (click)="choose(it)"
                >
                  <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    @if (imgOf(it)) {
                      <img [src]="imgOf(it)!" class="w-full h-full object-cover" />
                    } @else {
                      <span class="text-[10px] text-slate-500">no img</span>
                    }
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

                    <div class="truncate text-xs text-slate-400">{{ it.label }}</div>
                  </div>

                  @if (isSelected(it)) {
                    <div class="text-emerald-300 text-xs font-semibold shrink-0">✓</div>
                  }
                </button>
              }

              @if (filtered().length === 0) {
                <div class="p-3 text-sm text-slate-400">Nada encontrado.</div>
              }
            </div>
          </div>
        }
      </div>

      @if (hint) {
        <div class="text-xs text-slate-500">{{ hint }}</div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionItemSelectComponent {
  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  /** Catálogo normalizado */
  private itemsSig = signal<AuctionCatalogItem[]>([]);
  @Input({ required: true })
  set items(v: AuctionCatalogItem[]) {
    this.itemsSig.set(Array.isArray(v) ? v : []);
  }
  get items() {
    return this.itemsSig();
  }

  /** valor selecionado (controlado pelo pai) */
  selectedRef = signal<AuctionItemRef | null>(null);
  @Input()
  set selected(v: AuctionItemRef | null) {
    this.selectedRef.set(v ?? null);
  }
  get selected() {
    return this.selectedRef();
  }

  /** tipo do select (valor simples, não signal) */
  @Input() type: UiType = 'Weapon';

  /** label do campo */
  @Input() label: string = 'Item';

  /** hint abaixo */
  @Input() hint: string = '';

  /** emite ref */
  @Output() selectedChange = new EventEmitter<AuctionItemRef | null>();

  open = signal(false);
  query = signal('');

  selectedItem = computed(() => {
    const sel = this.selectedRef();
    if (!sel) return null;

    const id = Number(sel.itemId);
    const t = sel.itemType;
    const slot = sel.slot ?? undefined;

    const arr = this.itemsSig();
    return arr.find((x) => x.itemType === t && x.itemId === id && (slot ? x.slot === slot : true)) ?? null;
  });

  selectedImg = computed(() => normalizeImgSrc(this.selectedItem()?.imagePath ?? null));
  selectedChips = computed(() => chipsFromItem(this.selectedItem()));

  chipsAll(it: AuctionCatalogItem) {
    return chipsFromItem(it);
  }

  filtered = computed(() => {
    const q = asStr(this.query()).toLowerCase();
    const want = mapUiTypeToItemType(this.type);

    // ✅ filtra por tipo PRIMEIRO
    const baseList = this.itemsSig().filter((x) => x.itemType === want);

    if (!q) return baseList;

    return baseList.filter((it) => {
      const base = `${it.name} ${it.label} ${it.itemType} ${it.slot ?? ''} ${it.itemId}`.toLowerCase();
      return base.includes(q);
    });
  });

  // ✅ quando muda o tipo, reseta dropdown/busca (e fecha se estiver aberto)
  ngOnChanges(changes: SimpleChanges) {
    if (changes['type'] && !changes['type'].firstChange) {
      this.query.set('');
      this.open.set(false);
    }
  }

  imgOf(it: AuctionCatalogItem) {
    return normalizeImgSrc(it.imagePath);
  }

  toggle() {
    this.open.set(!this.open());
    if (this.open()) {
      setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 0);
    }
  }

  close() {
    this.open.set(false);
    this.query.set('');
  }

  clear() {
    this.selectedRef.set(null);
    this.selectedChange.emit(null);
    this.close();
  }

  choose(it: AuctionCatalogItem) {
    const ref: AuctionItemRef = {
      itemType: it.itemType,
      itemId: it.itemId,
      slot: it.slot,
    };
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

  // Fecha ao clicar fora
  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.open()) return;
    const root = this.rootRef?.nativeElement;
    const target = ev.target as Node | null;
    if (!root || !target) return;
    if (!root.contains(target)) this.close();
  }

  // ESC fecha
  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open()) this.close();
  }
}
