import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { EventsApi, EventDefinition, type EventInstance, type EventCategory } from '../../api/events.api';
import { EventToastManager } from '../../events/event-toast.manager';
import { ToastService } from '../../ui/toast/toast.service';

type Duration = 15 | 30 | 45 | 60;
type AdminTab = 'active' | 'ended' | 'cancelled' | 'all';

function isEnded(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}
function isCancelled(ev: EventInstance) {
  return Boolean((ev as any).isCanceled) || Boolean(ev.canceledAt);
}
function isActive(ev: EventInstance) {
  return !isCancelled(ev) && !isEnded(ev.expiresAt);
}

function isCancellable(ev: EventInstance) {
  return (isActive(ev) || isEnded(ev.expiresAt) && !isCancelled(ev));
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <div class="text-xl font-semibold">Eventos (Admin)</div>
        <div class="text-sm text-slate-400">Crie, monitore, cancele eventos e gerencie tipos de evento.</div>
      </div>

      <!-- CREATE EVENT -->
      <div class="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-slate-300">
            @if (loadingDefs()) { Carregando eventos... }
            @else { Selecione o evento, defina a senha, tempo e se é dobrado (x2). }
          </div>
          <button
            class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 disabled:opacity-50"
            (click)="loadDefinitions()"
            [disabled]="loadingDefs()"
          >
            Recarregar lista
          </button>
        </div>

        @if (defsError()) {
          <div class="text-sm text-red-300">{{ defsError() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Evento -->
          <div class="md:col-span-1">
            <label class="text-sm text-slate-300">Evento</label>
            <select
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              formControlName="definitionCode"
              [disabled]="loadingDefs() || creating()"
            >
              <option value="" disabled>Selecione...</option>
              @for (d of definitions(); track d.code) {
                <option [value]="d.code">{{ d.title }} (+{{ d.points }})</option>
              }
            </select>
            @if (form.controls.definitionCode.touched && form.controls.definitionCode.invalid) {
              <div class="mt-1 text-xs text-red-300">Selecione um evento.</div>
            }
          </div>

          <!-- Duração -->
          <div class="md:col-span-1">
            <label class="text-sm text-slate-300">Duração do evento</label>
            <select
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              formControlName="durationMinutes"
              [disabled]="creating()"
            >
              <option [ngValue]="15">15 min</option>
              <option [ngValue]="30">30 min</option>
              <option [ngValue]="45">45 min</option>
              <option [ngValue]="60">60 min</option>
            </select>
            <div class="mt-2 text-xs text-slate-400">O evento expira após esse tempo.</div>
          </div>

          <!-- Senha -->
          <div class="md:col-span-1">
            <label class="text-sm text-slate-300">Senha do evento</label>
            <input
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              formControlName="password"
              placeholder="Ex: EVENTO123"
              [disabled]="creating()"
              autocomplete="off"
            />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <div class="mt-1 text-xs text-red-300">Informe uma senha (mínimo 3).</div>
            }
            <div class="mt-2 text-xs text-slate-400">Todos os usuários receberão um toast pedindo essa senha.</div>
          </div>

          <!-- DOBRADO -->
          <div class="md:col-span-1">
            <label class="text-sm text-slate-300">Pontos</label>
            <div class="mt-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
              <label class="flex items-center gap-2 text-sm text-slate-200 select-none">
                <input
                  type="checkbox"
                  class="accent-indigo-500"
                  formControlName="isDoubled"
                  [disabled]="creating()"
                />
                Pontos dobrados (x2)
              </label>
            </div>
          </div>

          <div class="md:col-span-4 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 disabled:opacity-50"
              (click)="reset()"
              [disabled]="creating()"
            >
              Limpar
            </button>
            <button
              class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              [disabled]="form.invalid || creating() || loadingDefs()"
            >
              {{ creating() ? 'Criando...' : 'Criar evento' }}
            </button>
          </div>
        </form>

        @if (createError()) {
          <div class="text-sm text-red-300">{{ createError() }}</div>
        }
      </div>

      <!-- CREATE DEFINITION -->
      <div class="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-semibold">Tipo de Evento</div>
            <div class="text-sm text-slate-400">Crie novos templates de evento (ex: PB evento, majors_X...).</div>
          </div>

          <button
            class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 disabled:opacity-50"
            (click)="loadDefinitions()"
            [disabled]="loadingDefs()"
          >
            Recarregar
          </button>
        </div>

        <form [formGroup]="defForm" (ngSubmit)="submitDefinition()">
         <div class="flex gap-4 flex-1 flex-wrap">
          <div class="flex-1 min-w-[120px]">
            <label class="text-sm text-slate-300">Code</label>
            <input
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              formControlName="code"
              placeholder="Ex: pbEtherEvento"
              [disabled]="creatingDef()"
              autocomplete="off"
            />
            @if (defForm.controls.code.touched && defForm.controls.code.invalid) {
              <div class="mt-1 text-xs text-red-300">Mín. 2 chars.</div>
            }
          </div>

          <!-- title -->
          <div class="flex-1 min-w-[120px]">
            <label class="text-sm text-slate-300">Título</label>
            <input
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              formControlName="title"
              placeholder="Ex: PB Ether - Evento"
              [disabled]="creatingDef()"
              autocomplete="off"
            />
            @if (defForm.controls.title.touched && defForm.controls.title.invalid) {
              <div class="mt-1 text-xs text-red-300">Mín. 2 chars.</div>
            }
          </div>

          <!-- points -->
          <div>
            <label class="text-sm text-slate-300">Pontos</label>
            <input
              type="number"
              class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
              formControlName="points"
              [disabled]="creatingDef()"
              min="0"
            />
            @if (defForm.controls.points.touched && defForm.controls.points.invalid) {
              <div class="mt-1 text-xs text-red-300">>= 0</div>
            }
          </div>
          </div>

          <div class="md:col-span-5 flex items-center justify-end gap-3 mt-3">
            <button
              class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              [disabled]="defForm.invalid || creatingDef()"
            >
              {{ creatingDef() ? 'Criando...' : 'Criar tipo' }}
            </button>
          </div>
        </form>

        @if (defError()) {
          <div class="text-sm text-red-300">{{ defError() }}</div>
        }

        <div class="pt-2">
          <div class="text-sm text-slate-400 mb-2">Tipos ativos:</div>
          <div class="overflow-auto rounded-xl border border-slate-800">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-900/60 text-slate-300">
                <tr>
                  <th class="text-left px-4 py-3 w-[90px]">Code</th>
                  <th class="text-left px-4 py-3">Título</th>
                  <th class="text-left px-4 py-3 w-[110px]">Pontos</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800">
                @for (d of definitions(); track d.id) {
                  <tr class="hover:bg-slate-900/30">
                    <td class="px-4 py-3 text-slate-200 font-mono">{{ d.code }}</td>
                    <td class="px-4 py-3 text-slate-100">{{ d.title }}</td>
                    <td class="px-4 py-3 text-slate-200">+{{ d.points }}</td>
                  </tr>
                }

                @if (!loadingDefs() && definitions().length === 0) {
                  <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-slate-400">
                      Nenhum tipo de evento encontrado.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- LIST ADMIN -->
      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div class="text-sm text-slate-300">
            @if (loadingEvents()) { Carregando eventos... }
            @else { {{ filteredEvents().length }} evento(s) }
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
              (click)="loadEvents()"
              [disabled]="loadingEvents()"
            >
              Recarregar
            </button>
          </div>
        </div>

        @if (eventsError()) {
          <div class="p-4 text-red-300">
            {{ eventsError() }}
            <button class="ml-2 underline" (click)="loadEvents()">tentar novamente</button>
          </div>
        } @else {
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-900/60 text-slate-300">
                <tr>
                  <th class="text-left px-4 py-3 w-[90px]">Status</th>
                  <th class="text-left px-4 py-3">Título</th>
                  <th class="text-left px-4 py-3 w-[110px]">Pontos</th>
                  <th class="text-left px-4 py-3 w-[190px]">Expira</th>
                  <th class="text-left px-4 py-3 w-[210px]">Ações</th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-800">
                @for (ev of filteredEvents(); track ev.id) {
                  <tr class="hover:bg-slate-900/30 align-middle">
                    <td class="px-4 py-3">
                      @if (isCancelledRow(ev)) {
                        <span class="px-2 py-1 rounded-full text-xs bg-red-900/30 border border-red-800 text-red-200">
                          Cancelled
                        </span>
                      } @else if (isActiveRow(ev)) {
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
                      <div class="text-xs text-slate-400 mt-1">
                        @if (ev.isDoubled) { <span class="text-amber-200">x2</span> } @else { <span>—</span> }
                        • base: +{{ ev.basePoints ?? '?' }}
                        • aplicado: +{{ ev.points }}
                      </div>
                      @if (isCancelledRow(ev) && ev.cancelReason) {
                        <div class="text-xs text-slate-400 mt-1">Motivo: {{ ev.cancelReason }}</div>
                      }
                    </td>

                    <td class="px-4 py-3 text-slate-200">+{{ ev.points }}</td>
                    <td class="px-4 py-3 text-slate-300 font-mono">{{ endDate(ev) }}</td>

                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <button
                          class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200"
                          (click)="copyId(ev.id)"
                        >
                          Copiar ID
                        </button>

                        @if (isCancellableRow(ev)) {
                          <button
                            class="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 border border-red-900 text-white disabled:opacity-50"
                            (click)="openCancel(ev)"
                            [disabled]="canceling()"
                          >
                            Cancelar
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }

                @if (!loadingEvents() && filteredEvents().length === 0) {
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
      </div>

      <!-- MODAL CANCEL -->
      @if (cancelModalOpen()) {
        <div class="fixed inset-0 z-[80] flex items-center justify-center">
          <div class="absolute inset-0 bg-black/60" (click)="closeCancel()"></div>

          <div class="relative w-[520px] max-w-[92vw] rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-lg font-semibold">Cancelar evento</div>
                <div class="text-sm text-slate-400">
                  {{ cancelTarget()?.title }} (+{{ cancelTarget()?.points }} pts)
                </div>
              </div>

              <button
                class="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 hover:bg-slate-800"
                (click)="closeCancel()"
              >
                X
              </button>
            </div>

            <div class="mt-4">
              <label class="text-sm text-slate-300">Motivo</label>
              <textarea
                class="mt-1 w-full min-h-[90px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
                [formControl]="cancelReason"
                placeholder="Ex: evento criado por engano / senha vazou / etc"
              ></textarea>
              @if (cancelReason.touched && cancelReason.invalid) {
                <div class="mt-1 text-xs text-red-300">Informe um motivo (mínimo 3).</div>
              }
            </div>

            @if (cancelError()) {
              <div class="mt-3 text-sm text-red-300">{{ cancelError() }}</div>
            }

            <div class="mt-4 flex justify-end gap-2">
              <button
                class="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200"
                (click)="closeCancel()"
                [disabled]="canceling()"
              >
                Voltar
              </button>

              <button
                class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                (click)="confirmCancel()"
                [disabled]="cancelReason.invalid || canceling()"
              >
                {{ canceling() ? 'Cancelando...' : 'Confirmar cancelamento' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class EventsAdminPage {
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private eventsManager = inject(EventToastManager);

  // defs + create event
  definitions = signal<EventDefinition[]>([]);
  loadingDefs = signal(false);
  defsError = signal('');

  creating = signal(false);
  createError = signal('');

  form = new FormGroup({
    definitionCode: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    durationMinutes: new FormControl<Duration>(15, { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    isDoubled: new FormControl<boolean>(false, { nonNullable: true }),
  });

  selectedDef = computed(() => {
    const code = this.form.controls.definitionCode.value;
    return this.definitions().find((d) => d.code === code) ?? null;
  });

  previewPoints = computed(() => {
    const d = this.selectedDef();
    if (!d) return 0;
    return this.form.controls.isDoubled.value ? d.points * 2 : d.points;
  });

  // create definition
  creatingDef = signal(false);
  defError = signal('');

  endDate(ev: EventInstance) { return new Date(ev.expiresAt).toLocaleDateString('pt-BR') + ' ' + new Date(ev.expiresAt).toLocaleTimeString('pt-BR'); }

  defForm = new FormGroup({
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    title: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    points: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    category: new FormControl<EventCategory>('GENERIC', { nonNullable: true, validators: [Validators.required] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  // events list
  events = signal<EventInstance[]>([]);
  loadingEvents = signal(false);
  eventsError = signal('');

  tab = signal<AdminTab>('active');

  filteredEvents = computed(() => {
    const t = this.tab();
    const list = this.events();

    const filtered =
      t === 'all'
        ? list
        : t === 'active'
          ? list.filter(isActive)
          : t === 'ended'
            ? list.filter((e) => !isCancelled(e) && isEnded(e.expiresAt))
            : list.filter(isCancelled);

    return [...filtered].sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  });

  // cancel modal
  cancelModalOpen = signal(false);
  cancelTarget = signal<EventInstance | null>(null);
  cancelReason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });
  canceling = signal(false);
  cancelError = signal('');

  constructor() {
    this.loadDefinitions();
    this.loadEvents();
  }

  isActiveRow(ev: EventInstance) { return isActive(ev); }
  isCancelledRow(ev: EventInstance) { return isCancelled(ev); }
  isCancellableRow(ev: EventInstance) { return isCancellable(ev); }

  loadDefinitions() {
    this.loadingDefs.set(true);
    this.defsError.set('');
    this.api.definitions().subscribe({
      next: (list) => this.definitions.set(list ?? []),
      error: (e) => this.defsError.set(e?.error?.message ?? 'Falha ao carregar lista de eventos'),
      complete: () => this.loadingDefs.set(false),
    });
  }

  reset() {
    this.createError.set('');
    this.form.reset({ definitionCode: '', durationMinutes: 15, password: '', isDoubled: false });
  }

  submit() {
    this.createError.set('');
    if (this.form.invalid || this.creating()) return;

    const payload = this.form.getRawValue();
    this.creating.set(true);

    this.api.create(payload as any).subscribe({
      next: (r: any) => {
        this.toast.success(`Evento criado: ${r?.title ?? 'OK'} (+${r?.points ?? '?'} pts)`);
        this.eventsManager.push({ id: r.id, title: r.title, points: r.points, expiresAt: r.expiresAt });
        this.reset();
        this.loadEvents();
      },
      error: (e) => {
        const msg = e?.error?.message ?? 'Falha ao criar evento';
        this.createError.set(msg);
        this.toast.error(msg);
      },
      complete: () => this.creating.set(false),
    });
  }

  resetDefinition() {
    this.defError.set('');
    this.defForm.reset({ code: '', title: '', points: 0, category: 'GENERIC', isActive: true });
  }

  submitDefinition() {
    this.defError.set('');
    if (this.defForm.invalid || this.creatingDef()) return;

    const payload = this.defForm.getRawValue();
    this.creatingDef.set(true);

    this.api.createDefinition(payload).subscribe({
      next: (def) => {
        this.toast.success(`Definition criada: ${def.code} (${def.title})`);
        this.resetDefinition();
        this.loadDefinitions();
      },
      error: (e) => {
        const msg = e?.error?.message ?? 'Falha ao criar definition';
        this.defError.set(msg);
        this.toast.error(msg);
      },
      complete: () => this.creatingDef.set(false),
    });
  }

  loadEvents() {
    this.loadingEvents.set(true);
    this.eventsError.set('');
    this.api.listAdmin().subscribe({
      next: (list) => this.events.set(list ?? []),
      error: (e) => this.eventsError.set(e?.error?.message ?? 'Falha ao carregar eventos'),
      complete: () => this.loadingEvents.set(false),
    });
  }

  copyId(id: number) {
    navigator.clipboard?.writeText(String(id));
    this.toast.success('ID copiado!');
  }

  openCancel(ev: EventInstance) {
    this.cancelTarget.set(ev);
    this.cancelReason.reset('');
    this.cancelError.set('');
    this.cancelModalOpen.set(true);
  }

  closeCancel(force = false) {
    if (!force && this.canceling()) return;
    this.cancelModalOpen.set(false);
    this.cancelTarget.set(null);
  }

  confirmCancel() {
    const ev = this.cancelTarget();
    if (!ev) return;
    if (this.cancelReason.invalid || this.canceling()) return;

    this.canceling.set(true);
    this.cancelError.set('');

    this.api.cancel(ev.id, this.cancelReason.value).subscribe({
      next: () => {
        this.canceling.set(false);
        this.toast.success('Evento cancelado.');
        this.closeCancel(true);
        this.loadEvents();
      },
      error: (e) => {
        this.cancelError.set(e?.error?.message ?? 'Falha ao cancelar evento');
      },
      complete: () => this.canceling.set(false),
    });
  }
}
