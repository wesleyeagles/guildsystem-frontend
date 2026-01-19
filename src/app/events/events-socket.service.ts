import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';

export type EventCreatedPayload = { id: number; title: string; points: number; expiresAt: string; isDoubled?: boolean };
export type EventCanceledPayload = { id: number; canceledAt: string; reason?: string | null };

@Injectable({ providedIn: 'root' })
export class EventsSocketService {
  private auth = inject(AuthService);
  private socket: Socket | null = null;
  private connectedToken: string | null = null;

  private getWsUrl() {
    return `${environment.apiUrl}/events`;
  }

  connect() {
    const token = this.auth.accessToken();
    if (!token) return;

    if (this.socket && this.connectedToken === token) return;

    if (this.socket && this.connectedToken !== token) {
      this.disconnect();
    }

    this.connectedToken = token;
    this.socket = io(this.getWsUrl(), {
      transports: ['websocket'],
      auth: { token },
      withCredentials: true,
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.connectedToken = null;
  }

  onEventCreated(cb: (p: EventCreatedPayload) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('eventCreated', cb);
  }

  offEventCreated(cb: (p: EventCreatedPayload) => void) {
    this.socket?.off('eventCreated', cb);
  }

  onEventCanceled(cb: (p: EventCanceledPayload) => void) {
    if (!this.socket) this.connect();
    this.socket?.on('eventCanceled', cb);
  }

  offEventCanceled(cb: (p: EventCanceledPayload) => void) {
    this.socket?.off('eventCanceled', cb);
  }
}
