import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    standalone: true,
    selector: 'app-helmets-toolbar',
    imports: [CommonModule],
    template: `
    <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="text-sm text-slate-300">Buscar</div>

        <div class="flex gap-2 items-center w-full md:w-[560px]">
          <input
            class="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100
                   placeholder:text-slate-500 outline-none focus:border-slate-600"
            [value]="query"
            (input)="queryChange.emit(($any($event.target).value))"
            placeholder="Nome, code, effects, defense..."
          />

          <button
            class="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200"
            (click)="queryChange.emit('')"
            [disabled]="!query"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class HelmetsToolbarComponent {
    @Input() query = '';
    @Output() queryChange = new EventEmitter<string>();
}
