import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-weapons-toolbar',
  templateUrl: './weapons-toolbar.component.html',
})
export class WeaponsToolbarComponent {
  @Input({ required: true }) query!: string;
  @Output() queryChange = new EventEmitter<string>();

  onQuery(v: string) {
    this.queryChange.emit(v);
  }
}
