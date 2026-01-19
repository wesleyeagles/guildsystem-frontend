// src/app/events/event-toast.component.ts
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { EventsApi } from '../api/events.api';
import { ToastService } from '../ui/toast/toast.service';
import { EventToastManager } from './event-toast.manager';
import { EVENT_TOAST_DATA, EVENT_TOAST_REF, type EventToastData, EventToastRef } from './event-toast.tokens';

function msLeft(expiresAtIso: string) {
  return new Date(expiresAtIso).getTime() - Date.now();
}
function fmt(ms: number) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="w-[360px] max-w-[90vw] rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-slate-100 truncate">{{ data.title }}</div>
          <div class="text-sm text-slate-300">
            +{{ data.points }} pontos • expira em <span class="font-mono">{{ timeLeftLabel() }}</span>
          </div>
        </div>
        <button
          class="shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          (click)="close()"
          aria-label="Fechar"
          title="Fechar"
        >
          X
        </button>
      </div>

      <div class="mt-3 flex gap-2">
        <input
          class="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100"
          [formControl]="password"
          placeholder="Senha do evento"
          [disabled]="submitting() || expired()"
        />
        <button
          class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
          [disabled]="password.invalid || submitting() || expired()"
          (click)="submit()"
        >
          {{ submitting() ? '...' : 'OK' }}
        </button>
      </div>

      @if (error()) {
        <div class="mt-2 text-xs text-red-300">{{ error() }}</div>
      }
      @if (expired()) {
        <div class="mt-2 text-xs text-amber-200">Evento expirado.</div>
      }
    </div>
  `,
})
export class EventToastComponent implements OnDestroy {
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private manager = inject(EventToastManager);

  data = inject<EventToastData>(EVENT_TOAST_DATA);
  ref = inject<EventToastRef>(EVENT_TOAST_REF);

  password = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  submitting = signal(false);
  error = signal('');

  private tick = signal(0);
  private timer: number | null = null;

  expired = computed(() => msLeft(this.data.expiresAt) <= 0);
  timeLeftLabel = computed(() => {
    this.tick();
    return fmt(msLeft(this.data.expiresAt));
  });

  constructor() {
    this.timer = window.setInterval(() => {
      this.tick.update((v) => v + 1);
      if (msLeft(this.data.expiresAt) <= 0) this.ref.dismiss();
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) window.clearInterval(this.timer);
  }

  close() {
    this.ref.dismiss();
  }

  submit() {
    this.error.set('');
    if (this.password.invalid || this.submitting() || this.expired()) return;

    this.submitting.set(true);

    this.api.claim(this.data.id, this.password.value).subscribe({
      next: (r) => {
        // ✅ marca globalmente como claimado
        this.manager.markClaimed(this.data.id);

        this.toast.success(`+${r.pointsAdded} pontos recebidos!`);
        this.ref.dismissWithAction();
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? 'Falha ao validar senha');
        this.submitting.set(false);
      },
      complete: () => this.submitting.set(false),
    });
  }
}
