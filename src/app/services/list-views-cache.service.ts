import { Injectable, inject } from '@angular/core';
import { Observable, finalize, shareReplay, tap } from 'rxjs';

import { UsersApi, type LeaderboardRow } from '../api/users.api';
import { EventsApi, type EventInstance } from '../api/events.api';

/**
 * Snapshot em memoria (stale-while-revalidate): ao voltar a rota, mostra dados anteriores
 * de imediato; load*() refaz HTTP para refletir o servidor.
 */
@Injectable({ providedIn: 'root' })
export class ListViewsCacheService {
  private readonly usersApi = inject(UsersApi);
  private readonly eventsApi = inject(EventsApi);

  private leaderboard = new Map<number, LeaderboardRow[]>();
  private eventsAll: EventInstance[] | null = null;

  private leaderboardInflight = new Map<number, Observable<LeaderboardRow[]>>();
  private eventsInflight: Observable<EventInstance[]> | null = null;

  peekLeaderboard(limit: number): LeaderboardRow[] | null {
    return this.leaderboard.get(limit) ?? null;
  }

  loadLeaderboard(limit: number): Observable<LeaderboardRow[]> {
    let obs = this.leaderboardInflight.get(limit);
    if (!obs) {
      obs = this.usersApi.leaderboard(limit).pipe(
        tap((rows) => {
          this.leaderboard.set(limit, rows ?? []);
        }),
        finalize(() => this.leaderboardInflight.delete(limit)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.leaderboardInflight.set(limit, obs);
    }
    return obs;
  }

  peekEventsList(): EventInstance[] | null {
    return this.eventsAll;
  }

  loadEventsList(): Observable<EventInstance[]> {
    if (!this.eventsInflight) {
      this.eventsInflight = this.eventsApi.listAll().pipe(
        tap((rows) => {
          this.eventsAll = rows ?? [];
        }),
        finalize(() => {
          this.eventsInflight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.eventsInflight;
  }

  /** Mantém snapshot alinhado após WS/mutações locais (ex.: lista pública de eventos). */
  syncEventsList(rows: EventInstance[] | null) {
    this.eventsAll = rows == null ? null : [...rows];
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
