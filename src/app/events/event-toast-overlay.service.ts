import { Injectable, Injector, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import { EventToastComponent } from './event-toast.component';
import { EVENT_TOAST_DATA, EVENT_TOAST_REF, EventToastRef, type EventToastData } from './event-toast.tokens';

@Injectable({ providedIn: 'root' })
export class EventToastOverlayService {
  private overlay = inject(Overlay);
  private injector = inject(Injector);

  private order: number[] = [];
  private refs = new Map<number, { overlayRef: OverlayRef; toastRef: EventToastRef }>();

  show(data: EventToastData) {
    if (this.refs.has(data.id)) return;

    const toastRef = new EventToastRef();

    const overlayRef = this.overlay.create({
      hasBackdrop: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      positionStrategy: this.overlay.position().global().bottom('16px').right('16px'),
      panelClass: ['event-toast-overlay'],
    });

    const childInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: EVENT_TOAST_DATA, useValue: data },
        { provide: EVENT_TOAST_REF, useValue: toastRef },
      ],
    });

    overlayRef.attach(new ComponentPortal(EventToastComponent, null, childInjector));

    this.refs.set(data.id, { overlayRef, toastRef });
    this.order.push(data.id);
    this.reposition();

    toastRef.afterDismissed().subscribe(() => {
      this.remove(data.id);
    });
  }

  // ✅ usado pra fechar toast via WS cancelamento
  dismiss(id: number) {
    const it = this.refs.get(id);
    if (!it) return;
    it.toastRef.dismiss();
  }

  private remove(id: number) {
    const it = this.refs.get(id);
    if (!it) return;

    it.overlayRef.detach();
    it.overlayRef.dispose();

    this.refs.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.reposition();
  }

  private reposition() {
    const GAP = 12;
    const HEIGHT = 150;

    this.order.forEach((id, idx) => {
      const it = this.refs.get(id);
      if (!it) return;

      const bottom = 16 + idx * (HEIGHT + GAP);

      it.overlayRef.updatePositionStrategy(
        this.overlay.position().global().bottom(`${bottom}px`).right('16px'),
      );
      it.overlayRef.updatePosition();
    });
  }
}
