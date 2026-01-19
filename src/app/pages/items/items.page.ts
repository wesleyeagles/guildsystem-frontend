import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { UiModalComponent } from '../../ui/modal/ui-modal.component';
import { UiConfirmDialogComponent } from '../../ui/modal/ui-confirm-dialog.component';

import { ItemsApi, Item, WeaponGrade, WeaponData } from '../../api/items.api';
import { CastsApi, Cast, API_BASE as API_BASE } from '../../api/casts.api';
import { ItemTypesApi, ItemType } from '../../api/item-types.api';

import { ItemPreviewComponent } from './components/item-preview.component';

type CastMini = { id: number; name: string; imagePath: string };

const BASE = API_BASE;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiModalComponent, UiConfirmDialogComponent, ItemPreviewComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-semibold">Items</div>
          <div class="text-sm text-slate-400">CRUD de items. Por enquanto: Weapon.</div>
        </div>

        <button class="px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white" (click)="openCreate()">
          + Novo Item
        </button>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="text-sm text-slate-300">
            @if (loading()) { Carregando... } @else { {{ items().length }} registro(s) }
          </div>

          <button class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800" (click)="load()">
            Atualizar
          </button>
        </div>

        @if (error()) {
          <div class="p-4 text-red-300">
            {{ error() }}
            <button class="ml-2 underline" (click)="load()">tentar novamente</button>
          </div>
        } @else {
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-900/60 text-slate-300">
                <tr>
                  <th class="text-left px-4 py-3">Imagem</th>
                  <th class="text-left px-4 py-3">Nome</th>
                  <th class="text-left px-4 py-3">Tipo</th>
                  <th class="text-left px-4 py-3">Grade</th>
                  <th class="text-left px-4 py-3">Level</th>
                  <th class="text-left px-4 py-3">Atk</th>
                  <th class="text-left px-4 py-3">Force</th>
                  <th class="text-left px-4 py-3">Cast</th>
                  <th class="text-left px-4 py-3">Atualizado</th>
                  <th class="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-800">
                @for (it of items(); track it.id) {
                  <tr class="hover:bg-slate-900/30">
                    <td class="px-4 py-3">
                      <div class="w-10 h-10 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                        <img class="w-full h-full object-cover" [src]="imageUrl(it.imagePath)" [alt]="it.name" />
                      </div>
                    </td>

                    <td class="px-4 py-3 text-slate-100">{{ it.name }}</td>
                    <td class="px-4 py-3 text-slate-300">{{ it.type }}</td>

                    <td class="px-4 py-3">
                      <span class="px-2 py-1 rounded-lg text-xs border" [ngClass]="gradeBadgeClass(it.data?.grade)">
                        {{ it.data?.grade || '-' }}
                      </span>
                    </td>

                    <td class="px-4 py-3 text-slate-300">{{ it.data?.level ?? '-' }}</td>
                    <td class="px-4 py-3 text-slate-300">
                      {{ it.data?.minAttack ?? '-' }}~{{ it.data?.maxAttack ?? '-' }}
                    </td>
                    <td class="px-4 py-3 text-slate-300">
                      {{ it.data?.minForceAttack ?? '-' }}~{{ it.data?.maxForceAttack ?? '-' }}
                    </td>

                    <!-- ✅ Cast com imagem (usa castForce vindo do backend; fallback pelo castForceId + casts carregados) -->
                    <td class="px-4 py-3">
                      @let cast = castMiniFromItem(it);

                      <div class="flex items-center gap-2">
                        @if (cast) {
                          @if (cast.imagePath) {
                            <div class="w-6 h-6 rounded-md overflow-hidden border border-slate-800 bg-slate-900 shrink-0">
                              <img class="w-full h-full object-cover" [src]="imageUrl(cast.imagePath)" [alt]="cast.name" />
                            </div>
                          }
                          <span class="text-emerald-300">{{ cast.name }}</span>
                        } @else {
                          <span class="text-slate-400">None</span>
                        }
                      </div>
                    </td>

                    <td class="px-4 py-3 text-slate-400">{{ formatDate(it.updatedAt) }}</td>

                    <td class="px-4 py-3">
                      <div class="flex items-center justify-end gap-2">
                        <button
                          class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200"
                          (click)="openEdit(it)"
                        >
                          Editar
                        </button>

                        <button
                          class="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white"
                          (click)="openDelete(it)"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                }

                @if (!loading() && items().length === 0) {
                  <tr>
                    <td colspan="10" class="px-4 py-8 text-center text-slate-400">Nenhum item cadastrado.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <ui-modal
      [open]="modalOpen()"
      [title]="modalTitle()"
      [showFooter]="true"
      [confirmText]="editing() ? 'Salvar alterações' : 'Criar Item'"
      [confirmDisabled]="saving() || form.invalid || (editing() === null && !pickedFile())"
      (close)="closeModal()"
      (confirm)="submit()"
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form class="space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <div class="space-y-2">
            <label class="text-sm text-slate-300">Nome</label>
            <input
              class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
              formControlName="name"
              placeholder="Eisen Ritter's Back Blade"
            />
            @if (form.get('name')?.touched && form.get('name')?.invalid) {
              <div class="text-xs text-red-300">Nome é obrigatório.</div>
            }
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm text-slate-300">Type</label>
              <select
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="type"
              >
                @for (t of activeItemTypes(); track t.id) {
                  <option [value]="t.code">{{ t.name }}</option>
                }
              </select>
              <div class="text-[11px] text-slate-500">Vem do backend (/item-types).</div>
            </div>

            <div class="space-y-2">
              <label class="text-sm text-slate-300">Grade</label>
              <select
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="grade"
              >
                @for (g of grades; track g) {
                  <option [value]="g">{{ g }}</option>
                }
              </select>
            </div>

            <div class="space-y-2">
              <label class="text-sm text-slate-300">Level</label>
              <input
                type="number"
                min="1"
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="level"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm text-slate-300">Cast (Force)</label>
              <select
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="castForceId"
              >
                <option value="">None</option>
                @for (c of casts(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>

              @if (selectedCastPreview()) {
                <div class="mt-2 flex items-center gap-2 text-xs text-slate-300">
                  <div class="w-6 h-6 rounded-md overflow-hidden border border-slate-800 bg-slate-900">
                    <img class="w-full h-full object-cover" [src]="selectedCastPreview()!" alt="Cast icon" />
                  </div>
                  <span>Debuff selecionado</span>
                </div>
              }
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm text-slate-300">Min Attack</label>
              <input
                type="number"
                min="0"
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="minAttack"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm text-slate-300">Max Attack</label>
              <input
                type="number"
                min="0"
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="maxAttack"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm text-slate-300">Min Force Attack</label>
              <input
                type="number"
                min="0"
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="minForceAttack"
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm text-slate-300">Max Force Attack</label>
              <input
                type="number"
                min="0"
                class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                formControlName="maxForceAttack"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate-300">Special Effects (1 por linha)</label>
            <textarea
              rows="4"
              class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
              formControlName="specialEffectsText"
              placeholder="moving speed 1.00 Increase."
            ></textarea>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <div class="flex items-center justify-between">
              <div class="text-sm text-slate-200 font-medium">Upgrade</div>

              <label class="text-sm text-slate-300 flex items-center gap-2">
                <input type="checkbox" class="accent-indigo-500" [checked]="useUpgrade()" (change)="toggleUpgrade()" />
                Habilitar
              </label>
            </div>

            @if (useUpgrade()) {
              <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label class="text-sm text-slate-300">Type</label>
                  <input
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                    [value]="upgradeType()"
                    (input)="upgradeType.set(($any($event.target).value ?? '').toString())"
                    placeholder="stone"
                  />
                </div>

                <div class="space-y-2">
                  <label class="text-sm text-slate-300">Quantity (1 a 7)</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
                    [value]="upgradeQty()"
                    (input)="upgradeQty.set(toNumber($any($event.target).value, 1))"
                  />
                </div>
              </div>
            }
          </div>

          <div class="space-y-2">
            <label class="text-sm text-slate-300">Imagem</label>
            <input
              type="file"
              accept="image/*"
              class="block w-full text-sm text-slate-300
                     file:mr-4 file:py-2 file:px-4 file:rounded-lg
                     file:border file:border-slate-800
                     file:bg-slate-900 file:text-slate-200
                     hover:file:bg-slate-800"
              (change)="onPickFile($event)"
            />

            <div class="text-xs text-slate-500">
              @if (editing()) { (opcional) selecione outra imagem para substituir. } @else { obrigatório no create. }
            </div>

            @if (fileError()) {
              <div class="text-xs text-red-300">{{ fileError() }}</div>
            }
          </div>

          @if (saveError()) {
            <div class="text-sm text-red-300">{{ saveError() }}</div>
          }
        </form>

        <div class="space-y-2">
          <div class="text-sm text-slate-400">Preview</div>

          <app-item-preview
            [imageUrl]="previewImageUrl()"
            [name]="previewName()"
            [typeLabel]="previewTypeLabel()"
            [grade]="previewGrade()"
            [level]="num(formValue().level)"
            [minAttack]="num(formValue().minAttack)"
            [maxAttack]="num(formValue().maxAttack)"
            [minForceAttack]="num(formValue().minForceAttack)"
            [maxForceAttack]="num(formValue().maxForceAttack)"
            [castName]="castForceName()"
            [castImageUrl]="castForceImageUrl()"
            [specialEffects]="specialEffectsArray()"
            [upgrade]="upgradePreview()"
          />
        </div>
      </div>
    </ui-modal>

    <ui-confirm-dialog
      [open]="deleteOpen()"
      title="Excluir Item"
      [message]="'Tem certeza que deseja excluir o item: ' + (toDelete()?.name ?? '') + ' ?'"
      cancelText="Cancelar"
      confirmText="Excluir"
      [confirmDisabled]="deleting()"
      (cancel)="closeDelete()"
      (confirm)="confirmDelete()"
    />
  `,
})
export class ItemsPage {
  private api = inject(ItemsApi);
  private castsApi = inject(CastsApi);
  private itemTypesApi = inject(ItemTypesApi);
  private fb = inject(FormBuilder);

  toNumber(v: any, fallback = 0) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  items = signal<Item[]>([]);
  casts = signal<Cast[]>([]);
  itemTypes = signal<ItemType[]>([]);

  activeItemTypes = computed(() => this.itemTypes().filter((t) => t.isActive));

  loading = signal(false);
  saving = signal(false);
  deleting = signal(false);

  error = signal('');
  saveError = signal('');
  fileError = signal('');

  modalOpen = signal(false);
  editing = signal<Item | null>(null);
  modalTitle = computed(() => (this.editing() ? 'Editar Item' : 'Novo Item'));

  deleteOpen = signal(false);
  toDelete = signal<Item | null>(null);

  grades: WeaponGrade[] = ['Normal', 'Intense', 'Orange', 'Green', 'Relic'];

  pickedFile = signal<File | null>(null);
  localPreviewUrl = signal<string | null>(null);

  useUpgrade = signal(false);
  upgradeType = signal('');
  upgradeQty = signal(1);

  form = this.fb.group({
    name: ['', [Validators.required]],
    type: ['weapon', [Validators.required]],

    grade: ['Normal' as WeaponGrade, [Validators.required]],
    level: [1, [Validators.required, Validators.min(1)]],

    minAttack: [0, [Validators.required, Validators.min(0)]],
    maxAttack: [0, [Validators.required, Validators.min(0)]],

    minForceAttack: [0, [Validators.required, Validators.min(0)]],
    maxForceAttack: [0, [Validators.required, Validators.min(0)]],

    castForceId: [''],
    specialEffectsText: [''],
  });

  readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  previewName = computed(() => {
    const n = this.formValue().name;
    if (typeof n === 'string' && n.trim()) return n.trim();
    return null;
  });

  previewGrade = computed(() => (this.formValue().grade as WeaponGrade) || 'Normal');

  previewTypeLabel = computed(() => {
    const code = String(this.formValue().type ?? '').trim();
    const found = this.itemTypes().find((t) => t.code === code);
    return found?.name ?? (code ? code : 'Item');
  });

  castForceName = computed(() => {
    const id = this.toNumber(this.formValue().castForceId, 0);
    if (!id) return null;
    return this.casts().find((c) => c.id === id)?.name ?? null;
  });

  castForceImageUrl = computed(() => {
    const id = this.toNumber(this.formValue().castForceId, 0);
    if (!id) return null;
    const c = this.casts().find((x) => x.id === id);
    if (!c?.imagePath) return null;
    return this.imageUrl(c.imagePath);
  });

  selectedCastPreview = computed(() => this.castForceImageUrl());

  specialEffectsArray = computed(() => {
    const raw = String(this.formValue().specialEffectsText ?? '').trim();
    if (!raw) return null;
    const lines = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length ? lines : null;
  });

  upgradePreview = computed(() => {
    if (!this.useUpgrade()) return null;
    const t = this.upgradeType().trim();
    const q = Math.max(1, Math.min(7, this.toNumber(this.upgradeQty(), 1)));
    if (!t) return null;
    return { type: t, quantity: q };
  });

  previewImageUrl = computed(() => {
    if (this.localPreviewUrl()) return this.localPreviewUrl()!;
    const it = this.editing();
    if (it?.imagePath) return this.imageUrl(it.imagePath);
    return null;
  });

  constructor() {
    this.load();
    this.loadCasts();
    this.loadItemTypes();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (list) => this.items.set(list),
      error: (e) => {
        const msg = e?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar items');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  loadCasts() {
    // ✅ apenas Force (debuff) para o select do weapon
    this.castsApi.list({ type: 'Debuff' }).subscribe({
      next: (list) => this.casts.set(list),
      error: () => this.casts.set([]),
    });
  }

  loadItemTypes() {
    this.itemTypesApi.listActive().subscribe({
      next: (list) => this.itemTypes.set(list),
      error: () =>
        this.itemTypes.set([
          {
            id: 0,
            code: 'weapon',
            name: 'Weapon',
            description: null,
            isActive: true,
            schema: null,
            createdAt: '',
            updatedAt: '',
          },
        ]),
    });
  }

  openCreate() {
    this.saveError.set('');
    this.fileError.set('');
    this.editing.set(null);

    this.form.reset({
      name: '',
      type: 'weapon',
      grade: 'Normal',
      level: 1,
      minAttack: 0,
      maxAttack: 0,
      minForceAttack: 0,
      maxForceAttack: 0,
      castForceId: '',
      specialEffectsText: '',
    });

    this.useUpgrade.set(false);
    this.upgradeType.set('');
    this.upgradeQty.set(1);

    this.pickedFile.set(null);
    this.clearLocalPreview();

    this.modalOpen.set(true);
  }

  openEdit(it: Item) {
    this.saveError.set('');
    this.fileError.set('');
    this.editing.set(it);

    const d = it.data as WeaponData;

    this.form.reset({
      name: it.name,
      type: String(it.type || 'weapon'),
      grade: d.grade ?? 'Normal',
      level: d.level ?? 1,
      minAttack: d.minAttack ?? 0,
      maxAttack: d.maxAttack ?? 0,
      minForceAttack: d.minForceAttack ?? 0,
      maxForceAttack: d.maxForceAttack ?? 0,
      castForceId: d.castForceId ? String(d.castForceId) : '',
      specialEffectsText: (d.specialEffects ?? []).join('\n'),
    });

    if (d.upgrade?.type) {
      this.useUpgrade.set(true);
      this.upgradeType.set(d.upgrade.type);
      this.upgradeQty.set(d.upgrade.quantity ?? 1);
    } else {
      this.useUpgrade.set(false);
      this.upgradeType.set('');
      this.upgradeQty.set(1);
    }

    this.pickedFile.set(null);
    this.clearLocalPreview();

    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.saving.set(false);
    this.saveError.set('');
    this.fileError.set('');
    this.pickedFile.set(null);
    this.clearLocalPreview();
  }

  toggleUpgrade() {
    this.useUpgrade.set(!this.useUpgrade());
    if (!this.useUpgrade()) {
      this.upgradeType.set('');
      this.upgradeQty.set(1);
    }
  }

  onPickFile(ev: Event) {
    this.fileError.set('');

    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.pickedFile.set(null);
      this.clearLocalPreview();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.fileError.set('Arquivo inválido. Selecione uma imagem.');
      this.pickedFile.set(null);
      this.clearLocalPreview();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.fileError.set('Imagem muito grande (máx 5MB).');
      this.pickedFile.set(null);
      this.clearLocalPreview();
      return;
    }

    this.pickedFile.set(file);

    this.clearLocalPreview();
    const url = URL.createObjectURL(file);
    this.localPreviewUrl.set(url);
  }

  private clearLocalPreview() {
    const prev = this.localPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.localPreviewUrl.set(null);
  }

  submit() {
    this.saveError.set('');
    this.fileError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError.set('Preencha os campos obrigatórios.');
      return;
    }

    const current = this.editing();
    const currentData = (current?.data ?? null) as WeaponData | null;

    const name = (this.previewName() ?? '').trim();
    if (!name) {
      this.saveError.set('Nome é obrigatório.');
      return;
    }

    const type = String(this.formValue().type ?? 'weapon');
    if (type !== 'weapon') {
      this.saveError.set('Por enquanto só suportamos Weapon.');
      return;
    }

    const minA = this.toNumber(this.formValue().minAttack, 0);
    const maxA = this.toNumber(this.formValue().maxAttack, 0);
    const minF = this.toNumber(this.formValue().minForceAttack, 0);
    const maxF = this.toNumber(this.formValue().maxForceAttack, 0);

    if (minA > maxA) {
      this.saveError.set('minAttack não pode ser maior que maxAttack.');
      return;
    }

    if (minF > maxF) {
      this.saveError.set('minForceAttack não pode ser maior que maxForceAttack.');
      return;
    }

    // cast: envia número, ou null pra limpar (se estava setado)
    const castRaw = String(this.formValue().castForceId ?? '').trim();
    let castForceIdPatch: number | null | undefined;
    if (!castRaw) {
      if (currentData?.castForceId) castForceIdPatch = null;
    } else {
      const id = this.toNumber(castRaw, 0);
      castForceIdPatch = id ? id : null;
    }

    // upgrade: envia objeto, ou null pra limpar (se estava setado)
    const upgradeObj = this.upgradePreview();
    let upgradePatch: { type: string; quantity: number } | null | undefined;
    if (upgradeObj) upgradePatch = upgradeObj;
    else if (currentData?.upgrade) upgradePatch = null;

    const data: WeaponData & any = {
      grade: this.previewGrade(),
      level: this.toNumber(this.formValue().level, 1),
      minAttack: minA,
      maxAttack: maxA,
      minForceAttack: minF,
      maxForceAttack: maxF,
    };

    const se = this.specialEffectsArray();
    if (se) data.specialEffects = se;

    if (castForceIdPatch !== undefined) data.castForceId = castForceIdPatch;
    if (upgradePatch !== undefined) data.upgrade = upgradePatch;

    const file = this.pickedFile();

    if (!current && !file) {
      this.fileError.set('Imagem é obrigatória para criar.');
      return;
    }

    this.saving.set(true);

    const req = current
      ? this.api.updateWeapon(current.id, { name, data }, file ?? undefined)
      : this.api.createWeapon({ name, type: 'weapon', data }, file!);

    req.subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => {
        const msg = e?.error?.message;
        this.saveError.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao salvar item');
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }

  openDelete(it: Item) {
    this.toDelete.set(it);
    this.deleteOpen.set(true);
  }

  closeDelete() {
    this.deleteOpen.set(false);
    this.toDelete.set(null);
    this.deleting.set(false);
  }

  confirmDelete() {
    const it = this.toDelete();
    if (!it) return;

    this.deleting.set(true);

    this.api.remove(it.id).subscribe({
      next: () => {
        this.closeDelete();
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.closeDelete();
        this.load();
      },
      complete: () => this.deleting.set(false),
    });
  }

  imageUrl(path: string) {
    return `${BASE}${path}`;
  }

  /**
   * ✅ preferimos o castForce que vem do backend; fallback: lookup local pelo castForceId
   */
  castMiniFromItem(it: Item): CastMini | null {
    // Mantive sem optional-chain aqui pra não bater no warning caso castForce seja tipado como sempre presente
    // (se no seu Item castForce for opcional, essa guarda continua segura do mesmo jeito).
    if ((it as any).castForce && (it as any).castForce.id) {
      const cf = (it as any).castForce;
      return { id: cf.id, name: cf.name, imagePath: cf.imagePath };
    }

    const id = (it.data as WeaponData | undefined)?.castForceId;
    if (!id) return null;

    const c = this.casts().find((x) => x.id === id);
    if (!c) return null;

    return { id: c.id, name: c.name, imagePath: c.imagePath };
  }

  formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  }

  num(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  gradeBadgeClass(grade?: WeaponGrade | null) {
    switch (grade) {
      case 'Relic':
        return 'border-yellow-700 text-yellow-200 bg-yellow-900/20';
      case 'Green':
        return 'border-emerald-700 text-emerald-200 bg-emerald-900/20';
      case 'Orange':
        return 'border-orange-700 text-orange-200 bg-orange-900/20';
      case 'Intense':
        return 'border-indigo-700 text-indigo-200 bg-indigo-900/20';
      case 'Normal':
      default:
        return 'border-slate-700 text-slate-200 bg-slate-900/40';
    }
  }
}

