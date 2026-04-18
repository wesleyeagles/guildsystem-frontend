import { Injectable, computed, inject, signal } from '@angular/core';

import { EventsApi, type ActiveEvent } from '../api/events.api';
import {
  EventsSocketService,
  type EventCreatedPayload,
  type EventCanceledPayload,
} from './events-socket.service';
import { EventToastOverlayService } from './event-toast-overlay.service';
import type { EventToastData } from './event-toast.tokens';

function stillValid(expiresAtIso: string) {
  return new Date(expiresAtIso).getTime() > Date.now();
}

@Injectable({ providedIn: 'root' })
export class EventToastManager {
  private api = inject(EventsApi);
  private socket = inject(EventsSocketService);
  private overlay = inject(EventToastOverlayService);

  private started = false;

  private opened = new Set<number>();
  private claimed = new Set<number>();
  private canceled = new Set<number>();

  // ✅ usado nas pages para "refrescar" UI
  private _version = signal(0);
  version = computed(() => this._version());

  /** Inicia WS + listeners e faz bootstrap com events ativos */
  init() {
    if (this.started) return;
    this.started = true;

    this.socket.connect();

    this.socket.onEventCreated((p) => this.handleIncoming(p));
    this.socket.onEventCanceled((p) => this.handleCanceled(p));

    // bootstrap: se já tiver ativo quando o user logar
    this.api.active().subscribe({
      next: (list) => (list ?? []).forEach((ev) => this.handleIncoming(ev)),
      error: () => {},
    });
  }

  /** Abre manualmente (quando usuário clica em "Reivindicar") */
  open(data: EventToastData) {
    // se já claimou/cancelou/expirou, não abre
    if (!stillValid(data.expiresAt)) return;
    if (this.canceled.has(data.id)) return;
    if (this.claimed.has(data.id)) return;

    this.opened.add(data.id);
    this.overlay.show({
      id: data.id,
      title: data.title,
      points: Number(data.points ?? 0) || 0,
      pilotBonusPoints: Number(data.pilotBonusPoints ?? 0) || 0,
      expiresAt: data.expiresAt,
    });

    // evita reabrir em sequência
    window.setTimeout(() => this.opened.delete(data.id), 250);
  }

  /** Marca como claimado e fecha o toast se estiver aberto */
  markClaimed(id: number) {
    this.claimed.add(id);
    this.overlay.dismiss(id);
    this.bump();
  }

  isClaimed(id: number) {
    return this.claimed.has(id);
  }

  isCanceled(id: number) {
    return this.canceled.has(id);
  }

  /** Para o admin (se quiser forçar abrir o toast na própria tela após criar) */
  push(ev: ActiveEvent | EventCreatedPayload) {
    this.handleIncoming(ev);
  }

  private handleCanceled(p: EventCanceledPayload) {
    this.canceled.add(p.id);
    this.overlay.dismiss(p.id);
    this.opened.delete(p.id);
    this.bump();
  }

  private handleIncoming(ev: ActiveEvent | EventCreatedPayload) {
    if (!ev?.id) return;
    if (!stillValid(ev.expiresAt)) return;
    if (this.canceled.has(ev.id)) return;
    if (this.claimed.has(ev.id)) return;

    // ✅ Se já abriu por click/manual ou já está aberto, não reabre
    if (this.opened.has(ev.id)) return;

    this.opened.add(ev.id);

    this.overlay.show({
      id: ev.id,
      title: String((ev as any).title ?? ''),
      points: Number((ev as any).points ?? 0) || 0,
      pilotBonusPoints: Number((ev as any).pilotBonusPoints ?? 0) || 0,
      expiresAt: String((ev as any).expiresAt ?? ''),
    });

    window.setTimeout(() => this.opened.delete(ev.id), 250);
    this.bump();
  }

  private bump() {
    this._version.update((v) => v + 1);
  }
}
