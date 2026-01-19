import { Injectable, inject } from '@angular/core';
import { EventsApi, type ActiveEvent } from '../api/events.api';
import { EventsSocketService, type EventCreatedPayload, type EventCanceledPayload } from './events-socket.service';
import { EventToastOverlayService } from './event-toast-overlay.service';

function stillValid(expiresAtIso: string) {
  return new Date(expiresAtIso).getTime() > Date.now();
}

@Injectable({ providedIn: 'root' })
export class EventToastManager {
  private api = inject(EventsApi);
  private socket = inject(EventsSocketService);
  private overlay = inject(EventToastOverlayService);

  private opened = new Set<number>();
  private claimed = new Set<number>();
  private canceled = new Set<number>();

  init() {
    this.socket.onEventCreated((p) => this.handleIncoming(p));
    this.socket.onEventCanceled((p) => this.handleCanceled(p));

    this.api.active().subscribe({
      next: (list) => list.forEach((ev) => this.handleIncoming(ev)),
      error: () => {},
    });
  }

  // ✅ útil pro admin: depois do POST /events
  push(ev: ActiveEvent | EventCreatedPayload) {
    this.handleIncoming(ev);
  }

  markClaimed(id: number) {
    this.claimed.add(id);
    this.overlay.dismiss(id);
  }

  isClaimed(id: number) {
    return this.claimed.has(id);
  }

  isCanceled(id: number) {
    return this.canceled.has(id);
  }

  private handleCanceled(p: EventCanceledPayload) {
    this.canceled.add(p.id);
    this.overlay.dismiss(p.id);
    this.opened.delete(p.id);
  }

  private handleIncoming(ev: ActiveEvent | EventCreatedPayload) {
    if (!stillValid(ev.expiresAt)) return;
    if (this.canceled.has(ev.id)) return;
    if (this.claimed.has(ev.id)) return;
    if (this.opened.has(ev.id)) return;

    this.opened.add(ev.id);

    this.overlay.show({
      id: ev.id,
      title: ev.title,
      points: ev.points,
      expiresAt: ev.expiresAt,
    });

    window.setTimeout(() => this.opened.delete(ev.id), 250);
  }
}
