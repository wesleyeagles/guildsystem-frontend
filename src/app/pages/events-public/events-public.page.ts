// src/app/pages/events/events-public.page.ts
import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { EventsApi, type EventInstance } from '../../api/events.api';
import { ToastService } from '../../ui/toast/toast.service';
import { EventToastManager } from '../../events/event-toast.manager';
import {
  EventsSocketService,
  type EventCanceledPayload,
  type EventCreatedPayload,
} from '../../events/events-socket.service';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';

type Tab = 'active' | 'ended' | 'cancelled' | 'all';

function nowMs() { return Date.now(); }
function ended(ev: EventInstance) { return new Date(ev.expiresAt).getTime() <= nowMs(); }
function cancelled(ev: EventInstance) { return Boolean((ev as any).isCanceled) || Boolean(ev.canceledAt); }
function active(ev: EventInstance) { return !cancelled(ev) && !ended(ev); }

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiSpinnerComponent],
  template: `
    <div class="space-y-6">
      <div>
        <div class="text-xl font-semibold">Eventos</div>
        <div class="text-sm text-slate-400">
          Veja eventos ativos e faça claim com a senha. Finalizados e cancelados também ficam listados.
        </div>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div class="text-sm text-slate-300">
            @if (loading()) {
              <ui-spinner [size]="16" text="Carregando..." />
            } @else {
              {{ filtered().length }} evento(s)
            }
          </div>

          <div class="flex items-center gap-2">
            <select
              class="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-sm"
              [value]="tab()"
              (change)="tab.set(($any($event.target).value))"
            >
              <option value="active">Ativos</option>
              <option value="ended">Finalizados</option>
              <option value="cancelled">Cancelados</option>
              <option value="all">Todos</option>
            </select>

            <button
              class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 disabled:opacity-50"
              (click)="load()"
              [disabled]="loading()"
            >
              @if (loading()) { <span>...</span> } @else { <span>Recarregar</span> }
            </button>
          </div>
        </div>

        @if (error()) {
          <div class="p-4 text-red-300">
            {{ error() }}
            <button class="ml-2 underline" (click)="load()">tentar novamente</button>
          </div>
        } @else {
          @if (loading() && filtered().length === 0) {
            <div class="p-6">
              <ui-spinner text="Carregando eventos..." />
            </div>
          } @else {
            <div class="overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-900/60 text-slate-300">
                  <tr>
                    <th class="text-left px-4 py-3 w-[90px]">Status</th>
                    <th class="text-left px-4 py-3">Evento</th>
                    <th class="text-left px-4 py-3 w-[110px]">Pontos</th>
                    <th class="text-left px-4 py-3 w-[190px]">Expira</th>
                    <th class="text-left px-4 py-3 w-[360px]">Claim</th>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-800">
                  @for (ev of filtered(); track ev.id) {
                    <tr class="hover:bg-slate-900/30 align-middle">
                      <td class="px-4 py-3">
                        @if (isCancelled(ev)) {
                          <span class="px-2 py-1 rounded-full text-xs bg-red-900/30 border border-red-800 text-red-200">
                            Cancelled
                          </span>
                        } @else if (isActive(ev)) {
                          <span class="px-2 py-1 rounded-full text-xs bg-emerald-900/30 border border-emerald-800 text-emerald-200">
                            Active
                          </span>
                        } @else {
                          <span class="px-2 py-1 rounded-full text-xs bg-slate-900 border border-slate-700 text-slate-200">
                            Ended
                          </span>
                        }
                      </td>

                      <td class="px-4 py-3">
                        <div class="font-medium text-slate-100">{{ ev.title }}</div>
                        @if (isCancelled(ev) && ev.cancelReason) {
                          <div class="text-xs text-slate-400 mt-1">Motivo: {{ ev.cancelReason }}</div>
                        }
                      </td>

                      <td class="px-4 py-3 text-slate-200">+{{ ev.points }}</td>

                      <td class="px-4 py-3 text-slate-300 font-mono">
                        {{ endDate(ev) }}
                      </td>

                      <td class="px-4 py-3">
                        @if (isActive(ev) && !isClaimed(ev)) {
                          <div class="flex items-center gap-2">
                            <input
                              class="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                              [formControl]="pw(ev.id)"
                              placeholder="Senha"
                              [disabled]="submittingId() === ev.id"
                            />
                            <button
                              class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                              (click)="claim(ev)"
                              [disabled]="pw(ev.id).invalid || submittingId() === ev.id"
                            >
                              @if (submittingId() === ev.id) { <span>...</span> } @else { <span>Claim</span> }
                            </button>
                          </div>

                          @if (rowErrorId() === ev.id && rowError()) {
                            <div class="mt-1 text-xs text-red-300">{{ rowError() }}</div>
                          }
                        }
                        @else if (isClaimed(ev)) {
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-indigo-900/30 border border-indigo-800 text-indigo-200">
                            Claimed
                          </span>
                        }
                        @else {
                          <span class="text-xs text-slate-500">—</span>
                        }
                      </td>
                    </tr>
                  }

                  @if (!loading() && filtered().length === 0) {
                    <tr>
                      <td colspan="5" class="px-4 py-10 text-center text-slate-400">
                        Nenhum evento encontrado.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class EventsPublicPage implements OnDestroy {
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private manager = inject(EventToastManager);
  private socket = inject(EventsSocketService);

  tab = signal<Tab>('active');

  list = signal<EventInstance[]>([]);
  loading = signal(false);
  error = signal('');

  submittingId = signal<number | null>(null);
  rowErrorId = signal<number | null>(null);
  rowError = signal('');

  private controls = new Map<number, FormControl<string>>();

  private onCanceledRef = (p: EventCanceledPayload) => this.onCanceled(p);
  private onCreatedRef = (p: EventCreatedPayload) => this.onCreated(p);

  endDate(ev: EventInstance) {
    return new Date(ev.expiresAt).toLocaleDateString('pt-BR') + ' ' + new Date(ev.expiresAt).toLocaleTimeString('pt-BR');
  }

  constructor() {
    this.load();

    this.socket.onEventCanceled(this.onCanceledRef);
    this.socket.onEventCreated(this.onCreatedRef);
  }

  ngOnDestroy() {
    this.socket.offEventCanceled(this.onCanceledRef);
    this.socket.offEventCreated(this.onCreatedRef);
  }

  isActive(ev: EventInstance) { return active(ev); }
  isCancelled(ev: EventInstance) { return cancelled(ev); }

  isClaimed(ev: EventInstance) {
    return Boolean(ev.claimedByMe) || this.manager.isClaimed(ev.id);
  }

  pw(id: number) {
    let c = this.controls.get(id);
    if (!c) {
      c = new FormControl('', { nonNullable: true, validators: [Validators.required] });
      this.controls.set(id, c);
    }
    return c;
  }

  filtered = computed(() => {
    const t = this.tab();
    const arr = this.list();

    const filtered =
      t === 'all'
        ? arr
        : t === 'active'
          ? arr.filter(active)
          : t === 'ended'
            ? arr.filter((e) => !cancelled(e) && ended(e))
            : arr.filter(cancelled);

    return [...filtered].sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  });

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.listAll().subscribe({
      next: (list) => this.list.set(list ?? []),
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar eventos'),
      complete: () => this.loading.set(false),
    });
  }

  claim(ev: EventInstance) {
    if (!active(ev)) return;

    const ctrl = this.pw(ev.id);
    if (ctrl.invalid) return;

    this.submittingId.set(ev.id);
    this.rowErrorId.set(null);
    this.rowError.set('');

    this.api.claim(ev.id, ctrl.value).subscribe({
      next: (r) => {
        this.manager.markClaimed(ev.id);
        this.toast.success(`+${r.pointsAdded} pontos recebidos!`);

        this.list.update((arr) =>
          arr.map((x) => (x.id === ev.id ? { ...x, claimedByMe: true, claimedAt: new Date().toISOString() } : x)),
        );

        ctrl.reset('');
      },
      error: (e) => {
        this.rowErrorId.set(ev.id);
        this.rowError.set(e?.error?.message ?? 'Senha inválida');
        this.submittingId.set(null);
      },
      complete: () => this.submittingId.set(null),
    });
  }

  private onCanceled(p: EventCanceledPayload) {
    this.list.update((arr) =>
      arr.map((x) => {
        if (x.id !== p.id) return x;
        return {
          ...x,
          isCanceled: true,
          canceledAt: p.canceledAt,
          cancelReason: p.reason ?? x.cancelReason ?? null,
          claimedByMe: false,
          claimedAt: null,
          claimReversedAt: p.canceledAt,
        };
      }),
    );

    if (this.submittingId() === p.id) this.submittingId.set(null);
    if (this.rowErrorId() === p.id) {
      this.rowErrorId.set(null);
      this.rowError.set('');
    }

    this.controls.get(p.id)?.reset('');
  }

  private onCreated(p: EventCreatedPayload) {
    const createdAt = new Date().toISOString();

    this.list.update((arr) => {
      const idx = arr.findIndex((x) => x.id === p.id);

      const nextItem: EventInstance = {
        id: p.id,
        title: p.title,
        points: p.points,
        expiresAt: p.expiresAt,
        createdAt,

        isCanceled: false,
        canceledAt: null,
        cancelReason: null,

        claimedByMe: false,
        claimedAt: null,
        claimReversedAt: null,
      };

      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], ...nextItem };
        return copy;
      }

      return [nextItem, ...arr];
    });
  }
}
