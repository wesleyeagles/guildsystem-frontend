import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-accessories-toolbar',
  imports: [CommonModule],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <div class="ml-auto flex items-center gap-2 w-full sm:w-auto">
        <input
          class="w-full sm:w-64 max-w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 outline-none focus:border-indigo-500"
          [value]="query"
          (input)="queryChange.emit(($any($event.target).value))"
          placeholder="Nome, code, effects, elementos, level..."
        />
      </div>
    </div>
  `,
})
export class AccessoriesToolbarComponent {
  @Input() query = '';
  @Output() queryChange = new EventEmitter<string>();
}
