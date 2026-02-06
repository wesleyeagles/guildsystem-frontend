import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

import { io, type Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';

import { AuthService } from '../auth/auth.service';

export type ItemDto = {
  id: number;

  category: string;
  type: string | null;

  name: string;
  imagePath: string | null;
  description: string | null;

  race: string | null;
  level: number | null;
  grade: string | null;

  attackMin: number | null;
  attackMax: number | null;
  forceAttackMin: number | null;
  forceAttackMax: number | null;
  castId: number | null;

  armorClass: string | null;
  defense: number | null;
  defenseSuccessRate: number | null;

  elements: string[] | null;

  specialEffects: string[];
  upgradeLevel: number | null;

  createdAt: string;
  updatedAt: string;
};

export type WsItemDeleted = { id: number };

@Injectable({ providedIn: 'root' })
export class ItemsSocketService {
  private auth = inject(AuthService);

  private socket: Socket | null = null;
  private connected$ = new BehaviorSubject<boolean>(false);

  private itemCreated$ = new Subject<ItemDto>();
  private itemUpdated$ = new Subject<ItemDto>();
  private itemDeleted$ = new Subject<WsItemDeleted>();

  isConnected() {
    return this.connected$.value;
  }

  connectedChanges() {
    return this.connected$.asObservable();
  }

  onItemCreated() {
    return this.itemCreated$.asObservable();
  }
  onItemUpdated() {
    return this.itemUpdated$.asObservable();
  }
  onItemDeleted() {
    return this.itemDeleted$.asObservable();
  }

  connect() {
    if (this.socket) return;

    const baseUrl =
      (environment as any).apiUrl ??
      (environment as any).baseUrl ??
      (environment as any).backendUrl ??
      (environment as any).wsUrl ??
      '';

    this.socket = io(baseUrl, {
      transports: ['websocket'],
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2500,
      timeout: 8000,
      path: undefined,
    });

    this.socket.disconnect();
    this.socket = io(`${baseUrl}/items`, {
      transports: ['websocket'],
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 400,
      reconnectionDelayMax: 2500,
      timeout: 8000,
      auth: { token: this.getToken() },
    });

    this.socket.on('connect', () => {
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connected$.next(false);
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.refreshAuth();
    });

    this.socket.on('itemCreated', (payload: ItemDto) => {
      this.itemCreated$.next(payload);
    });

    this.socket.on('itemUpdated', (payload: ItemDto) => {
      this.itemUpdated$.next(payload);
    });

    this.socket.on('itemDeleted', (payload: WsItemDeleted) => {
      this.itemDeleted$.next(payload);
    });

    this.socket.connect();
  }

  disconnect() {
    if (!this.socket) return;

    try {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    } finally {
      this.socket = null;
      this.connected$.next(false);
    }
  }

  ensureConnected() {
    if (!this.socket) this.connect();
    else if (!this.socket.connected) {
      this.refreshAuth();
      this.socket.connect();
    }
  }

  refreshAuth() {
    if (!this.socket) return;
    (this.socket as any).auth = { token: this.getToken() };
  }

  private getToken(): string | null {
    const a: any = this.auth as any;

    const t =
      (typeof a.accessToken === 'function' ? a.accessToken() : null) ??
      (typeof a.token === 'function' ? a.token() : null) ??
      (typeof a.getAccessToken === 'function' ? a.getAccessToken() : null) ??
      a.accessToken ??
      a.token ??
      null;

    if (typeof t === 'string' && t.trim()) return t.trim();

    const ls =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('jwt') ||
      null;

    return ls && ls.trim() ? ls.trim() : null;
  }
}
