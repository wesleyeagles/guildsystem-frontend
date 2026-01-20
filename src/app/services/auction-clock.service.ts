import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuctionClockService {
  private offsetMs = signal<number>(0);

  setServerTimeMs(serverTimeMs: number) {
    const clientNow = Date.now();
    this.offsetMs.set(serverTimeMs - clientNow);
  }

  nowMs() {
    return Date.now() + this.offsetMs();
  }
}
