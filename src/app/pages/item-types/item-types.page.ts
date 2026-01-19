import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { ItemTypesApi, ItemType } from '../../api/item-types.api';
import { UiModalComponent } from '../../ui/modal/ui-modal.component';
import { UiConfirmDialogComponent } from '../../ui/modal/ui-confirm-dialog.component';

@Component({
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, UiModalComponent, UiConfirmDialogComponent],
    template: `
    <div class="mx-auto space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-semibold">Tipos de Itens</div>
          <div class="text-sm text-slate-400">Gerencie os tipos usados no cadastro de itens.</div>
        </div>

        <button
          class="px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white"
          (click)="openCreate()"
        >
          + Novo tipo
        </button>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="text-sm text-slate-300">
            @if (loading()) {
              Carregando...
            } @else {
              {{ items().length }} registro(s)
            }
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              class="accent-indigo-500"
              [checked]="includeInactive()"
              (change)="toggleInactive()"
            />
            Mostrar inativos
          </label>
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
                  <th class="text-left px-4 py-3">Code</th>
                  <th class="text-left px-4 py-3">Nome</th>
                  <th class="text-left px-4 py-3">Ativo</th>
                  <th class="text-left px-4 py-3">Atualizado</th>
                  <th class="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-800">
                @for (it of items(); track it.id) {
                  <tr class="hover:bg-slate-900/30">
                    <td class="px-4 py-3 font-mono text-slate-200">{{ it.code }}</td>
                    <td class="px-4 py-3 text-slate-100">{{ it.name }}</td>

                    <td class="px-4 py-3">
                      <span
                        class="px-2 py-1 rounded-lg text-xs border"
                        [ngClass]="it.isActive
    ? 'border-green-800 text-green-300 bg-green-900/20'
    : 'border-slate-700 text-slate-300 bg-slate-900/40'"
                      >
                        {{ it.isActive ? 'Sim' : 'Não' }}
                      </span>
                    </td>

                    <td class="px-4 py-3 text-slate-300">{{ formatDate(it.updatedAt) }}</td>

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
                    <td colspan="5" class="px-4 py-8 text-center text-slate-400">
                      Nenhum tipo encontrado.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Modal Create/Edit -->
    <ui-modal
      [open]="modalOpen()"
      [title]="modalTitle()"
      [showFooter]="true"
      [confirmText]="editing() ? 'Salvar alterações' : 'Criar tipo'"
      [confirmDisabled]="form.invalid || saving()"
      (close)="closeModal()"
      (confirm)="submit()"
    >
      <form class="grid grid-cols-1 md:grid-cols-2 gap-4" [formGroup]="form" (ngSubmit)="submit()">
        <div class="space-y-2">
          <label class="text-sm text-slate-300">Code</label>
          <input
            class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
            formControlName="code"
            [readonly]="editing() !== null"
            placeholder="weapon"
          />
          <div class="text-xs text-slate-500">minúsculo, números, _ ou - (ex: weapon, helmet, boots)</div>
          @if (form.get('code')?.touched && form.get('code')?.invalid) {
            <div class="text-xs text-red-300">Code inválido.</div>
          }
        </div>

        <div class="space-y-2">
          <label class="text-sm text-slate-300">Nome</label>
          <input
            class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
            formControlName="name"
            placeholder="Weapon"
          />
          @if (form.get('name')?.touched && form.get('name')?.invalid) {
            <div class="text-xs text-red-300">Nome é obrigatório.</div>
          }
        </div>

        <div class="space-y-2 md:col-span-2">
          <label class="text-sm text-slate-300">Descrição (opcional)</label>
          <input
            class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
            formControlName="description"
            placeholder="Armas"
          />
        </div>

        <div class="md:col-span-2 flex items-center gap-3">
          <input type="checkbox" class="accent-indigo-500" formControlName="isActive" />
          <div class="text-sm text-slate-200">Ativo</div>
        </div>

        @if (saveError()) {
          <div class="md:col-span-2 text-sm text-red-300">
            {{ saveError() }}
          </div>
        }
      </form>
    </ui-modal>

    <!-- Confirm Delete -->
    <ui-confirm-dialog
      [open]="deleteOpen()"
      title="Excluir tipo"
      [message]="'Tem certeza que deseja excluir o tipo: ' + (toDelete()?.name ?? '') + ' ?'"
      cancelText="Cancelar"
      confirmText="Excluir"
      [confirmDisabled]="deleting()"
      (cancel)="closeDelete()"
      (confirm)="confirmDelete()"
    />
  `,
})
export class ItemTypesPage {
    private api = inject(ItemTypesApi);
    private fb = inject(FormBuilder);

    loading = signal(false);
    saving = signal(false);
    deleting = signal(false);

    error = signal('');
    saveError = signal('');

    includeInactive = signal(false);
    items = signal<ItemType[]>([]);

    modalOpen = signal(false);
    editing = signal<ItemType | null>(null);

    deleteOpen = signal(false);
    toDelete = signal<ItemType | null>(null);

    modalTitle = computed(() => (this.editing() ? 'Editar tipo' : 'Novo tipo'));

    form = this.fb.group({
        code: ['', [Validators.required, Validators.pattern(/^[a-z0-9_-]+$/)]],
        name: ['', [Validators.required]],
        description: [''],
        isActive: [true],
    });

    constructor() {
        this.load();
    }

    toggleInactive() {
        this.includeInactive.set(!this.includeInactive());
        this.load();
    }

    load() {
        this.loading.set(true);
        this.error.set('');

        const req = this.includeInactive() ? this.api.listAll() : this.api.listActive();

        req.subscribe({
            next: (list) => this.items.set(list),
            error: (e) => {
                const msg = e?.error?.message;
                this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao carregar tipos');
                this.loading.set(false);
            },
            complete: () => this.loading.set(false),
        });
    }

    openCreate() {
        this.saveError.set('');
        this.editing.set(null);

        this.form.reset({
            code: '',
            name: '',
            description: '',
            isActive: true,
        });

        this.modalOpen.set(true);
    }

    openEdit(it: ItemType) {
        this.saveError.set('');
        this.editing.set(it);

        this.form.reset({
            code: it.code,
            name: it.name,
            description: it.description ?? '',
            isActive: it.isActive,
        });

        // code não deve mudar
        this.form.get('code')?.disable({ emitEvent: false });

        this.modalOpen.set(true);
    }

    closeModal() {
        this.modalOpen.set(false);
        this.saving.set(false);
        this.saveError.set('');
        this.form.get('code')?.enable({ emitEvent: false });
    }

    submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.saveError.set('');

        const raw = this.form.getRawValue();
        const payload = {
            code: String(raw.code).trim(),
            name: String(raw.name).trim(),
            description: String(raw.description ?? '').trim() || undefined,
            isActive: !!raw.isActive,
        };

        const current = this.editing();

        const req = current
            ? this.api.update(current.id, {
                name: payload.name,
                description: payload.description,
                isActive: payload.isActive,
            })
            : this.api.create(payload);

        req.subscribe({
            next: () => {
                this.closeModal();
                this.load();
            },
            error: (e) => {
                const msg = e?.error?.message;
                this.saveError.set(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Falha ao salvar');
                this.saving.set(false);
            },
            complete: () => this.saving.set(false),
        });
    }

    openDelete(it: ItemType) {
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
                // se quiser depois colocamos toast
                this.deleting.set(false);
                this.closeDelete();
                this.load();
            },
            complete: () => this.deleting.set(false),
        });
    }

    formatDate(iso: string) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleString();
    }
}
