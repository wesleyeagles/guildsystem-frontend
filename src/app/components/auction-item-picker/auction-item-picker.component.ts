// src/app/components/auction-item-picker/auction-item-picker.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import type {
  AuctionCatalogItem,
  AuctionCatalogEffect,
  AuctionItemRef,
} from '../../services/auction-item-catalog.service';
import { API_BASE } from '../../api/auctions.api';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';

type UiType = 'Weapon' | 'Armor' | 'Accessory';
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

  // dedupe case-insensitive
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
  selector: 'app-auction-item-picker',
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auction-item-picker.component.html',
})
export class AuctionItemPickerComponent {
  @Input({ required: true }) type!: UiType;

  // itens atualmente carregados (paginados)
  @Input() items: AuctionCatalogItem[] = [];

  @Input() selected: AuctionItemRef | null = null;

  @Input() loading = false;
  @Input() hasMore = false;

  @Input() search = '';
  @Output() searchChange = new EventEmitter<string>();

  @Output() selectedChange = new EventEmitter<AuctionItemRef | null>();

  @Output() loadMore = new EventEmitter<void>();

  q = signal('');

  ngOnChanges() {
    this.q.set(this.search ?? '');
  }

  onSearch(v: string) {
    const s = asStr(v);
    this.q.set(s);
    this.searchChange.emit(s);
  }

  pick(it: AuctionCatalogItem) {
    this.selectedChange.emit({
      itemType: it.itemType,
      itemId: it.itemId,
      slot: (it as any).slot ?? undefined,
    });
  }

  isSelected(it: AuctionCatalogItem) {
    if (!this.selected) return false;
    return (
      String(this.selected.itemType) === String(it.itemType) &&
      Number(this.selected.itemId) === Number(it.itemId) &&
      String((this.selected as any).slot ?? '') === String((it as any).slot ?? '')
    );
  }

  img(it: AuctionCatalogItem) {
    return normalizeImgSrc(it.imagePath);
  }

  // ✅ chips pra renderizar lado a lado no HTML
  chips(it: AuctionCatalogItem): EffectChip[] {
    return effectsChipsFromItem(it);
  }

  label(it: AuctionCatalogItem) {
    const parts: string[] = [];
    if ((it as any).label) parts.push(String((it as any).label));
    return parts.join(' • ') || '—';
  }

  onLoadMore() {
    if (this.loading) return;
    this.loadMore.emit();
  }

  clear() {
    this.selectedChange.emit(null);
  }

  trackId(_i: number, it: AuctionCatalogItem) {
    return `${it.itemType}:${it.itemId}:${(it as any).slot ?? ''}`;
  }
}
