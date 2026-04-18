import { Injectable, Injector, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import { EventToastComponent } from './event-toast.component';
import { EVENT_TOAST_DATA, EVENT_TOAST_REF, EventToastRef, type EventToastData } from './event-toast.tokens';

@Injectable({ providedIn: 'root' })
export class EventToastOverlayService {
  private overlay = inject(Overlay);
  private injector = inject(Injector);

  private current: { id: number; overlayRef: OverlayRef; toastRef: EventToastRef } | null = null;

  show(data: EventToastData) {
    // se já está aberto para o mesmo evento, não faz nada
    if (this.current?.id === data.id) return;

    // modal único no centro
    this.dismissAll();

    const toastRef = new EventToastRef();

    const overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      panelClass: ['event-toast-overlay'],
    });

    // clique fora fecha
    overlayRef.backdropClick().subscribe(() => toastRef.dismiss());

    const childInjector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: EVENT_TOAST_DATA, useValue: data },
        { provide: EVENT_TOAST_REF, useValue: toastRef },
      ],
    });

    overlayRef.attach(new ComponentPortal(EventToastComponent, null, childInjector));

    this.current = { id: data.id, overlayRef, toastRef };

    toastRef.afterDismissed().subscribe(() => {
      this.removeCurrent();
    });
  }

  dismiss(id: number) {
    if (this.current?.id !== id) return;
    this.current.toastRef.dismiss();
  }

  dismissAll() {
    if (!this.current) return;
    this.current.toastRef.dismiss();
  }

  private removeCurrent() {
    const it = this.current;
    if (!it) return;

    it.overlayRef.detach();
    it.overlayRef.dispose();
    this.current = null;
  }
}
