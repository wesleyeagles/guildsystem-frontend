import { InjectionToken } from '@angular/core';
import { Subject } from 'rxjs';

export type EventToastData = {
  id: number;
  title: string;
  points: number;
  expiresAt: string;
};

export class EventToastRef {
  private _dismissed$ = new Subject<{ dismissedByAction: boolean }>();

  afterDismissed() {
    return this._dismissed$.asObservable();
  }

  dismiss() {
    this._dismissed$.next({ dismissedByAction: false });
    this._dismissed$.complete();
  }

  dismissWithAction() {
    this._dismissed$.next({ dismissedByAction: true });
    this._dismissed$.complete();
  }
}

export const EVENT_TOAST_DATA = new InjectionToken<EventToastData>('EVENT_TOAST_DATA');
export const EVENT_TOAST_REF = new InjectionToken<EventToastRef>('EVENT_TOAST_REF');
