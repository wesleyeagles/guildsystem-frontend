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
        <div class="w-20 h-20 rounded-md border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden flex items-center justify-center shrink-0">
          @if (imgUrl) {
            <img [src]="imgUrl" class="w-full h-full object-contain" alt="" />
          } @else {
            <div class="text-[10px] text-[var(--muted)]">sem</div>
          }
        </div>

        <div class="min-w-0">
          <div class="text-lg font-extrabold tracking-tight truncate" [style.color]="titleColor()">
            {{ item.name || 'Item' }}
          </div>
          <div class="text-xs text-[var(--muted)]">
            {{ item.category }}
            @if (item.type) {
              <span class="text-[var(--muted)]"> • {{ item.type }}</span>
            }
            @if (item.level !== null && item.level !== undefined) {
              <span class="text-[var(--muted)]"> • Lv {{ item.level }}</span>
            }
          </div>
        </div>
      </div>

      <div class="mt-3 space-y-1 text-sm">
        @if (item.category === 'Weapon') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-[var(--muted)]">Required Level</div>
            <div class="text-[var(--text)]">{{ item.level ?? '-' }}</div>

            <div class="text-[var(--muted)]">Race</div>
            <div class="text-[var(--text)]">{{ item.race ?? '-' }}</div>

            <div class="text-[var(--muted)]">Grade</div>
            <div class="text-[var(--text)]">{{ item.grade ?? '-' }}</div>

            <div class="text-[var(--muted)]">Attack</div>
            <div class="text-[var(--text)]">{{ rangeAtk() ?? '-' }}</div>

            <div class="text-[var(--muted)]">Force Attack</div>
            <div class="text-[var(--text)]">{{ rangeFAtk() ?? '-' }}</div>

            <div class="text-[var(--muted)]">Cast</div>
            <div class="text-[var(--text)]">{{ item.castId ?? '-' }}</div>

            <div class="text-[var(--muted)]">Upgrade</div>
            <div class="text-[var(--text)]">{{ item.upgradeLevel !== null ? ('+' + item.upgradeLevel) : '-' }}</div>
          </div>
        }

        @if (item.category === 'Armor') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-[var(--muted)]">Type</div>
            <div class="text-[var(--text)]">{{ item.type ?? '-' }}</div>

            <div class="text-[var(--muted)]">Required Level</div>
            <div class="text-[var(--text)]">{{ item.level ?? '-' }}</div>

            <div class="text-[var(--muted)]">Race</div>
            <div class="text-[var(--text)]">{{ item.race ?? '-' }}</div>

            <div class="text-[var(--muted)]">Armor Class</div>
            <div class="text-[var(--text)]">{{ item.armorClass ?? '-' }}</div>

            <div class="text-[var(--muted)]">Defense</div>
            <div class="text-[var(--text)]">{{ item.defense ?? '-' }}</div>

            <div class="text-[var(--muted)]">Defense SR</div>
            <div class="text-[var(--text)]">{{ item.defenseSuccessRate ?? '-' }}</div>

            <div class="text-[var(--muted)]">Grade</div>
            <div class="text-[var(--text)]">{{ item.grade ?? '-' }}</div>

            <div class="text-[var(--muted)]">Upgrade</div>
            <div class="text-[var(--text)]">{{ item.upgradeLevel !== null ? ('+' + item.upgradeLevel) : '-' }}</div>
          </div>
        }

        @if (item.category === 'Shield') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-[var(--muted)]">Type</div>
            <div class="text-[var(--text)]">{{ item.type ?? 'Shield' }}</div>

            <div class="text-[var(--muted)]">Required Level</div>
            <div class="text-[var(--text)]">{{ item.level ?? '-' }}</div>

            <div class="text-[var(--muted)]">Race</div>
            <div class="text-[var(--text)]">{{ item.race ?? '-' }}</div>

            <div class="text-[var(--muted)]">Defense</div>
            <div class="text-[var(--text)]">{{ item.defense ?? '-' }}</div>

            <div class="text-[var(--muted)]">Defense SR</div>
            <div class="text-[var(--text)]">{{ item.defenseSuccessRate ?? '-' }}</div>

            <div class="text-[var(--muted)]">Grade</div>
            <div class="text-[var(--text)]">{{ item.grade ?? '-' }}</div>

            <div class="text-[var(--muted)]">Upgrade</div>
            <div class="text-[var(--text)]">{{ item.upgradeLevel !== null ? ('+' + item.upgradeLevel) : '-' }}</div>
          </div>
        }

        @if (item.category === 'Accessory') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-[var(--muted)]">Type</div>
            <div class="text-[var(--text)]">{{ item.type ?? '-' }}</div>

            <div class="text-[var(--muted)]">Required Level</div>
            <div class="text-[var(--text)]">{{ item.level ?? '-' }}</div>

            <div class="text-[var(--muted)]">Race</div>
            <div class="text-[var(--text)]">{{ item.race ?? '-' }}</div>

            <div class="text-[var(--muted)]">Elements</div>
            <div class="text-[var(--text)]">{{ elementsLine() ?? '-' }}</div>
          </div>
        }

        @if (item.category === 'Resource' || item.category === 'Booty') {
          <div class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-[var(--muted)]">Category</div>
            <div class="text-[var(--text)]">{{ item.category }}</div>
          </div>
        }
      </div>

      @if (effectsLine()) {
        <div class="mt-3">
          <div class="text-xs text-[var(--muted)] mb-1">Special Effects</div>
          <div class="space-y-1">
            @for (e of effectsLine()!; track e) {
              <div class="text-sm text-[var(--text)]">{{ e }}</div>
            }
          </div>
        </div>
      }

      @if (item.description) {
        <div class="mt-3 border-t border-[var(--border)] pt-2">
          <div class="text-xs text-[var(--muted)] mb-1">Description</div>
          <div class="text-sm text-[var(--text)] whitespace-pre-line">{{ item.description }}</div>
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
