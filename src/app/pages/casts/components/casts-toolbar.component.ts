import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import type { CastTypeFilter } from '../casts.types';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-casts-toolbar',
  templateUrl: './casts-toolbar.component.html',
})
export class CastsToolbarComponent {
  @Input({ required: true }) tabs!: { label: string; value: CastTypeFilter }[];
  @Input({ required: true }) selected!: CastTypeFilter;
  @Input({ required: true }) query!: string;

  // função pra mostrar contagem (evita replicar estado aqui)
  @Input({ required: true }) countByType!: (t: CastTypeFilter) => number;

  @Output() typeChange = new EventEmitter<CastTypeFilter>();
  @Output() queryChange = new EventEmitter<string>();

  onType(v: CastTypeFilter) {
    this.typeChange.emit(v);
  }

  onQuery(v: string) {
    this.queryChange.emit(v);
  }
}
