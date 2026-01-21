import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { EventInstance, EventsApi } from '../../../api/events.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../../ui/toast/toast.service';
import { EventToastManager } from '../../../events/event-toast.manager';
import { EventCanceledPayload, EventCreatedPayload, EventsSocketService } from '../../../events/events-socket.service';

type Tab = 'active' | 'ended' | 'cancelled' | 'all';

function nowMs() { return Date.now(); }
function ended(ev: EventInstance) { return new Date(ev.expiresAt).getTime() <= nowMs(); }
function cancelled(ev: EventInstance) { return Boolean((ev as any).isCanceled) || Boolean(ev.canceledAt); }
function active(ev: EventInstance) { return !cancelled(ev) && !ended(ev); }

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiSpinnerComponent],
  templateUrl: './events-public.page.html',
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
