import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { API_BASE, Cast } from '../../../api/casts.api';
import { CastEffectsPresenter } from '../cast-effects.presenter';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-casts-table',
  templateUrl: './casts-table.component.html',
})
export class CastsTableComponent {
  private effects = inject(CastEffectsPresenter);

  @Input({ required: true }) items!: readonly Cast[];
  @Input() isEmpty = false;

  @Output() enterDetails = new EventEmitter<{ ev: MouseEvent; item: Cast }>();
  @Output() leaveDetails = new EventEmitter<void>();

  imageUrl(p: string) {
    return `${API_BASE}${p}`;
  }

  hasDetails(it: Cast) {
    return this.effects.hasDetails(it);
  }

  onEnter(ev: MouseEvent, it: Cast) {
    this.enterDetails.emit({ ev, item: it });
  }
}
