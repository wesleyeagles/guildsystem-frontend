import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import type {
  AuctionCatalogItem,
  AuctionCatalogEffectDto,
  AuctionItemRef,
} from '../../services/auction-item-catalog.service';
import { API_BASE } from '../../api/auctions.api';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';

// ✅ aceita tudo que vier do form (Weapon | Shield | Armor | Accessory | Resource | Booty | ...)
type UiType = AuctionItemRef['itemType'] | string;

type EffectChip = { text: string };

function asStr(v: any) {
  return String(v ?? '').trim();
}
function lower(s: string) {
  return asStr(s).toLowerCase();
}
function toNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeImgSrc(src: string | null | undefined) {
  const s = asStr(src);
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;

  const base = API_BASE.replace(/\/$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${base}${path}`;
}

/**
 * ✅ Se o backend já manda a string pronta (ex: e.text / e.display / e.formatted),
 * usa isso. Senão, cai num fallback simples.
 */
function effectText(e: AuctionCatalogEffectDto): string {
  const anyE = e as any;

  const ready =
    asStr(anyE.text) ||
    asStr(anyE.display) ||
    asStr(anyE.formatted) ||
    asStr(anyE.valueText) ||
    asStr(anyE.labelText);

  if (ready) return ready;

  // fallback: "Label +10" / "Label -2"
  const label = asStr((e as any).label);
  const v = toNum((e as any).value);
  if (!label || !Number.isFinite(v) || v === 0) return '';

  const sign = v < 0 ? '-' : '+';
  const abs = Math.abs(v);
  const num = Number.isInteger(abs)
    ? String(abs)
    : abs.toFixed(2).replace(/\.00$/, '');

  return `${label} ${sign}${num}`.trim();
}

/**
 * ✅ Chips de "stats base" (Attack / Force Attack) — NUNCA em %.
 * Eles podem vir como attackMin/attackMax etc.
 * Se não vierem, não mostra nada.
 */
function baseStatChipsFromItem(it: AuctionCatalogItem): EffectChip[] {
  const anyIt = it as any;

  const chips: EffectChip[] = [];

  const aMin = toNum(anyIt.attackMin);
  const aMax = toNum(anyIt.attackMax);
  if (Number.isFinite(aMin) && Number.isFinite(aMax)) {
    const txt = aMin === aMax ? `Attack ${Math.trunc(aMin)}` : `Attack ${Math.trunc(aMin)} - ${Math.trunc(aMax)}`;
    chips.push({ text: txt });
  }

  const fMin = toNum(anyIt.forceAttackMin);
  const fMax = toNum(anyIt.forceAttackMax);
  if (Number.isFinite(fMin) && Number.isFinite(fMax)) {
    const txt = fMin === fMax ? `Force Attack ${Math.trunc(fMin)}` : `Force Attack ${Math.trunc(fMin)} - ${Math.trunc(fMax)}`;
    chips.push({ text: txt });
  }


  return chips;
}

function effectChipsFromItem(it: AuctionCatalogItem): EffectChip[] {
  const fx = (it.effects ?? [])
    .map((e) => ({ text: effectText(e) }))
    .filter((c) => asStr(c.text));

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
  imports: [CommonModule, UiSpinnerComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auction-item-picker.component.html',
})
export class AuctionItemPickerComponent {
  @Input({ required: true }) type!: UiType;

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

  chips(it: AuctionCatalogItem): EffectChip[] {
    return [...baseStatChipsFromItem(it), ...effectChipsFromItem(it)];
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
