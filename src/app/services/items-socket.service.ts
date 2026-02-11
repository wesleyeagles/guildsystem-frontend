import { Inject, Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../core/api-urls.tokens';
import { Observable } from 'rxjs';

export type WsItemDeleted = { id: number };
export type ItemDto = any;

@Injectable({ providedIn: 'root' })
export class ItemsSocketService {
  private socket: Socket | null = null;

  constructor(@Inject(WS_URL) private wsUrl: string) {}

  ensureConnected() {
    if (this.socket?.connected) return;

    this.socket = io(this.wsUrl, {
      transports: ['websocket'],
      withCredentials: true,
    });
  }

  onItemCreated(): Observable<ItemDto> {
    return new Observable((sub) => {
      this.ensureConnected();
      const s = this.socket!;
      const handler = (p: any) => sub.next(p);
      s.on('items.created', handler);
      return () => s.off('items.created', handler);
    });
  }

  onItemUpdated(): Observable<ItemDto> {
    return new Observable((sub) => {
      this.ensureConnected();
      const s = this.socket!;
      const handler = (p: any) => sub.next(p);
      s.on('items.updated', handler);
      return () => s.off('items.updated', handler);
    });
  }

  onItemDeleted(): Observable<WsItemDeleted> {
    return new Observable((sub) => {
      this.ensureConnected();
      const s = this.socket!;
      const handler = (p: any) => sub.next(p);
      s.on('items.deleted', handler);
      return () => s.off('items.deleted', handler);
    });
  }
}
