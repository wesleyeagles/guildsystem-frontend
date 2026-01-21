import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-accessories-toolbar',
  imports: [CommonModule],
  templateUrl: './accessories-toolbar.component.html',
})
export class AccessoriesToolbarComponent {
  @Input() query = '';
  @Output() queryChange = new EventEmitter<string>();
}
