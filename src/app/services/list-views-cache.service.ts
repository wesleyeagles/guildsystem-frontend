import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { UsersApi, type LeaderboardRow } from '../api/users.api';
import { EventsApi, type EventInstance } from '../api/events.api';

/**
 * Último snapshot em memória para stale-while-revalidate: ao voltar à rota, mostra dados
 * anteriores de imediato (sem bloquear em loading vazio), mas load*() **sempre** refaz HTTP
 * para refletir o que está no servidor.
 */
@Injectable({ providedIn: 'root' })
export class ListViewsCacheService {
  private readonly usersApi = inject(UsersApi);
  private readonly eventsApi = inject(EventsApi);

  private leaderboard = new Map<number, LeaderboardRow[]>();
  private eventsAll: EventInstance[] | null = null;

  peekLeaderboard(limit: number): LeaderboardRow[] | null {
    return this.leaderboard.get(limit) ?? null;
  }

  loadLeaderboard(limit: number): Observable<LeaderboardRow[]> {
    return this.usersApi.leaderboard(limit).pipe(
      tap((rows) => {
        this.leaderboard.set(limit, rows ?? []);
      }),
    );
  }

  peekEventsList(): EventInstance[] | null {
    return this.eventsAll;
  }

  loadEventsList(): Observable<EventInstance[]> {
    return this.eventsApi.listAll().pipe(
      tap((rows) => {
        this.eventsAll = rows ?? [];
      }),
    );
  }

  invalidateLeaderboard(limit?: number) {
    if (limit == null) {
      this.leaderboard.clear();
    } else {
      this.leaderboard.delete(limit);
    }
  }

  invalidateEventsList() {
    this.eventsAll = null;
  }
}
