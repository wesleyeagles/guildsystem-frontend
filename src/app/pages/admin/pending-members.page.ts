import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsersApi, type SafeUser } from '../../api/users.api';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../ui/toast/toast.service';

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

@Component({
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent],
  template: `
    <div class="space-y-6">
      <div>
        <div class="text-xl font-semibold">Membros pendentes</div>
        <div class="text-sm text-slate-400">
          Aceite os usuários que se registraram e ainda não foram aprovados.
        </div>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div class="text-sm text-slate-300">
            @if (loading()) {
              <ui-spinner [size]="16" text="Carregando..." />
            } @else {
              {{ list().length }} pendente(s)
            }
          </div>
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
                  <th class="text-left px-4 py-3">Nickname</th>
                  <th class="text-left px-4 py-3 w-[1000px]">Email</th>
                  <th class="text-left px-4 py-3 w-[200px]">Criado em</th>
                  <th class="text-left px-4 py-3 w-[140px]">Ação</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-800">
                @for (u of list(); track u.id) {
                  <tr class="hover:bg-slate-900/30 align-middle">
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-100">{{ u.nickname }}</div>
                    </td>

                    <td class="px-4 py-3 text-slate-300">
                      {{ u.email }}
                    </td>

                    <td class="px-4 py-3 text-slate-300 font-mono">
                      {{ fmtDateTimePtBR(u.createdAt) }}
                    </td>

                    <td class="px-4 py-3">
                      <button
                        class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm"
                        (click)="accept(u)"
                        [disabled]="acceptingId() === u.id || loading()"
                      >
                        @if (acceptingId() === u.id) { <span>...</span> } @else { <span>Aceitar</span> }
                      </button>
                    </td>
                  </tr>
                }

                @if (!loading() && list().length === 0) {
                  <tr>
                    <td colspan="4" class="px-4 py-10 text-center text-slate-400">
                      Nenhum usuário pendente 🎉
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class PendingMembersPage {
  private api = inject(UsersApi);
  private toast = inject(ToastService);

  list = signal<SafeUser[]>([]);
  loading = signal(false);
  error = signal('');

  acceptingId = signal<number | null>(null);

  fmtDateTimePtBR = fmtDateTimePtBR;

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.pending().subscribe({
      next: (arr) => this.list.set(arr ?? []),
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar pendentes'),
      complete: () => this.loading.set(false),
    });
  }

  accept(u: SafeUser) {
    this.acceptingId.set(u.id);

    this.api.accept(u.id).subscribe({
      next: () => {
        this.toast.success(`Usuário ${u.nickname} aceito!`);
        this.list.update((arr) => arr.filter((x) => x.id !== u.id));
      },
      error: (e) => this.toast.error(e?.error?.message ?? 'Falha ao aceitar usuário'),
      complete: () => this.acceptingId.set(null),
    });
  }
}
