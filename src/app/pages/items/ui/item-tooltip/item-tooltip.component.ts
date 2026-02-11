import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemDto } from '../../../../api/items.api';

function fmtRange(a: number | null, b: number | null) {
  if (a === null || b === null) return null;
  return `${a} - ${b}`;
}

function fmtList(arr: any) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.join(', ');
}

@Component({
  standalone: true,
  selector: 'app-item-tooltip',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-3 w-[380px] max-w-[90vw]">
      <div class="flex items-start gap-3">
        <div class="w-20 h-20 rounded-md border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
          @if (imgUrl) {
            <img [src]="imgUrl" class="w-full h-full object-contain" alt="" />
          } @else {
            <div class="text-[10px] text-slate-500">sem</div>
          }
        </div>

        <div class="min-w-0">
          <div class="text-lg font-extrabold tracking-tight truncate" [style.color]="titleColor()">
            {{ item.name || 'Item' }}
          </div>
          <div class="text-xs text-slate-400">
            {{ item.category }}
            @if (item.type) {
              <span class="text-slate-500"> • {{ item.type }}</span>
            }
            @if (item.level !== null && item.level !== undefined) {
              <span class="text-slate-500"> • Lv {{ item.level }}</span>
            }
          </div>
        </div>
      </div>

      <div class="mt-3 space-y-1 text-sm">
        @if (item.category === 'Weapon') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-slate-400">Required Level</div>
            <div class="text-slate-100">{{ item.level ?? '-' }}</div>

            <div class="text-slate-400">Race</div>
            <div class="text-slate-100">{{ item.race ?? '-' }}</div>

            <div class="text-slate-400">Grade</div>
            <div class="text-slate-100">{{ item.grade ?? '-' }}</div>

            <div class="text-slate-400">Attack</div>
            <div class="text-slate-100">{{ rangeAtk() ?? '-' }}</div>

            <div class="text-slate-400">Force Attack</div>
            <div class="text-slate-100">{{ rangeFAtk() ?? '-' }}</div>

            <div class="text-slate-400">Cast</div>
            <div class="text-slate-100">{{ item.castId ?? '-' }}</div>

            <div class="text-slate-400">Upgrade</div>
            <div class="text-slate-100">{{ item.upgradeLevel !== null ? ('+' + item.upgradeLevel) : '-' }}</div>
          </div>
        }

        @if (item.category === 'Armor') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-slate-400">Type</div>
            <div class="text-slate-100">{{ item.type ?? '-' }}</div>

            <div class="text-slate-400">Required Level</div>
            <div class="text-slate-100">{{ item.level ?? '-' }}</div>

            <div class="text-slate-400">Race</div>
            <div class="text-slate-100">{{ item.race ?? '-' }}</div>

            <div class="text-slate-400">Armor Class</div>
            <div class="text-slate-100">{{ item.armorClass ?? '-' }}</div>

            <div class="text-slate-400">Defense</div>
            <div class="text-slate-100">{{ item.defense ?? '-' }}</div>

            <div class="text-slate-400">Defense SR</div>
            <div class="text-slate-100">{{ item.defenseSuccessRate ?? '-' }}</div>

            <div class="text-slate-400">Grade</div>
            <div class="text-slate-100">{{ item.grade ?? '-' }}</div>

            <div class="text-slate-400">Upgrade</div>
            <div class="text-slate-100">{{ item.upgradeLevel !== null ? ('+' + item.upgradeLevel) : '-' }}</div>
          </div>
        }

        @if (item.category === 'Shield') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-slate-400">Type</div>
            <div class="text-slate-100">{{ item.type ?? 'Shield' }}</div>

            <div class="text-slate-400">Required Level</div>
            <div class="text-slate-100">{{ item.level ?? '-' }}</div>

            <div class="text-slate-400">Race</div>
            <div class="text-slate-100">{{ item.race ?? '-' }}</div>

            <div class="text-slate-400">Defense</div>
            <div class="text-slate-100">{{ item.defense ?? '-' }}</div>

            <div class="text-slate-400">Defense SR</div>
            <div class="text-slate-100">{{ item.defenseSuccessRate ?? '-' }}</div>

            <div class="text-slate-400">Grade</div>
            <div class="text-slate-100">{{ item.grade ?? '-' }}</div>

            <div class="text-slate-400">Upgrade</div>
            <div class="text-slate-100">{{ item.upgradeLevel !== null ? ('+' + item.upgradeLevel) : '-' }}</div>
          </div>
        }

        @if (item.category === 'Accessory') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-slate-400">Type</div>
            <div class="text-slate-100">{{ item.type ?? '-' }}</div>

            <div class="text-slate-400">Required Level</div>
            <div class="text-slate-100">{{ item.level ?? '-' }}</div>

            <div class="text-slate-400">Race</div>
            <div class="text-slate-100">{{ item.race ?? '-' }}</div>

            <div class="text-slate-400">Elements</div>
            <div class="text-slate-100">{{ elementsLine() ?? '-' }}</div>
          </div>
        }

        @if (item.category === 'Resource' || item.category === 'Booty') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-slate-400">Category</div>
            <div class="text-slate-100">{{ item.category }}</div>
          </div>
        }
      </div>

      @if (effectsLine()) {
        <div class="mt-3">
          <div class="text-xs text-slate-400 mb-1">Special Effects</div>
          <div class="space-y-1">
            @for (e of effectsLine()!; track e) {
              <div class="text-sm text-slate-100">{{ e }}</div>
            }
          </div>
        </div>
      }

      @if (item.description) {
        <div class="mt-3 border-t border-slate-800 pt-2">
          <div class="text-xs text-slate-400 mb-1">Description</div>
          <div class="text-sm text-slate-100 whitespace-pre-line">{{ item.description }}</div>
        </div>
      }
    </div>
  `,
})
export class ItemTooltipComponent {
  @Input({ required: true }) item!: ItemDto;
  @Input() imgUrl: string | null = null;

  rangeAtk() {
    return fmtRange(this.item.attackMin, this.item.attackMax);
  }

  rangeFAtk() {
    return fmtRange(this.item.forceAttackMin, this.item.forceAttackMax);
  }

  elementsLine() {
    return fmtList(this.item.elements);
  }

  effectsLine(): string[] | null {
    const arr = Array.isArray(this.item.specialEffects) ? this.item.specialEffects.filter((x) => !!String(x ?? '').trim()) : [];
    return arr.length ? arr : null;
  }

  titleColor() {
    const c = this.item.category;
    if (c === 'Weapon') return '#22c55e';
    if (c === 'Armor') return '#fde047';
    if (c === 'Shield') return '#60a5fa';
    if (c === 'Accessory') return '#e5e7eb';
    if (c === 'Booty') return '#c084fc';
    return '#e5e7eb';
  }
}
