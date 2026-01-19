import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WeaponGrade } from '../../../api/items.api';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-item-preview',
  template: `
    <div class="rounded-2xl border border-slate-800 bg-slate-950/70 backdrop-blur p-4">
      <div class="flex gap-4">
        <div class="w-20 h-20 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shrink-0">
          @if (imageUrl) {
            <img class="w-full h-full object-cover" [src]="imageUrl" alt="Item image" />
          } @else {
            <div class="w-full h-full flex items-center justify-center text-xs text-slate-400">Sem imagem</div>
          }
        </div>

        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold truncate" [ngClass]="gradeClass()">
            {{ name || 'Item' }}
          </div>

          <div class="mt-1 text-xs text-slate-300">
            Type <span class="text-slate-100">{{ typeLabel }}</span>
          </div>

          <div class="mt-1 text-xs text-slate-300">
            Required Level <span class="text-slate-100">{{ level ?? '-' }}</span>
          </div>
        </div>
      </div>

      <div class="mt-4 border-t border-slate-800 pt-3 space-y-1 text-xs text-slate-300">
        <div class="flex justify-between gap-4">
          <span class="text-slate-400">Attack</span>
          <span class="text-slate-100">{{ minAttack ?? '-' }} ~ {{ maxAttack ?? '-' }}</span>
        </div>

        <div class="flex justify-between gap-4">
          <span class="text-slate-400">Force Attack</span>
          <span class="text-slate-100">{{ minForceAttack ?? '-' }} ~ {{ maxForceAttack ?? '-' }}</span>
        </div>

        <!-- ✅ Cast com imagem -->
        <div class="flex justify-between gap-4 items-center">
          <span class="text-slate-400">Cast</span>

          <span class="flex items-center gap-2" [ngClass]="castName ? 'text-emerald-300' : 'text-slate-200'">
            @if (castName && castImageUrl) {
              <span class="w-5 h-5 rounded-md overflow-hidden border border-slate-800 bg-slate-900 shrink-0">
                <img class="w-full h-full object-cover" [src]="castImageUrl" [alt]="castName" />
              </span>
            }

            {{ castName ? ('Cast: ' + castName) : 'Cast: None' }}
          </span>
        </div>

        @if (specialEffects?.length) {
          <div class="mt-2 text-slate-400">Special Effects</div>
          <ul class="list-disc pl-5 space-y-1">
            @for (s of specialEffects; track $index) {
              <li class="text-slate-100">{{ s }}</li>
            }
          </ul>
        }

        @if (upgrade) {
          <div class="mt-2 text-slate-400">Upgrade</div>
          <div class="text-slate-100">{{ upgrade.type }} × {{ upgrade.quantity }}</div>
        }
      </div>
    </div>
  `,
})
export class ItemPreviewComponent {
  @Input() imageUrl: string | null = null;

  @Input() name: string | null = null;
  @Input() typeLabel = 'Weapon';
  @Input() grade: WeaponGrade | null = null;

  @Input() level: number | null = null;
  @Input() minAttack: number | null = null;
  @Input() maxAttack: number | null = null;
  @Input() minForceAttack: number | null = null;
  @Input() maxForceAttack: number | null = null;

  @Input() castName: string | null = null;
  @Input() castImageUrl: string | null = null;

  @Input() specialEffects: string[] | null = null;
  @Input() upgrade: { type: string; quantity: number } | null = null;

  gradeClass() {
    switch (this.grade) {
      case 'Intense':
        return 'text-indigo-300';
      case 'Orange':
        return 'text-orange-300';
      case 'Green':
        return 'text-emerald-300';
      case 'Relic':
        return 'text-yellow-300';
      case 'Normal':
      default:
        return 'text-slate-100';
    }
  }
}
