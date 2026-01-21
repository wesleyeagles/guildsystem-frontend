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
  templateUrl: './auction-item-select.component.html',
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
