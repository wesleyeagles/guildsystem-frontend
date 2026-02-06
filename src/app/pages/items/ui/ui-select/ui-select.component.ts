// src/app/pages/items/ui/ui-select.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type UiSelectOption<T = any> = {
  value: T;
  label: string;
  subLabel?: string | null;
  iconUrl?: string | null;
  disabled?: boolean;
};

function lower(v: any) {
  return String(v ?? '').toLowerCase();
}

@Component({
  standalone: true,
  selector: 'app-ui-select',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: 'ui-select.component.scss',
  templateUrl: 'ui-select.component.html',
})
export class UiSelectComponent<T = any> {
  private host = inject(ElementRef<HTMLElement>);

  @ViewChild('anchor', { static: false }) anchor?: ElementRef<HTMLElement>;

  @Input() label = 'Selecionar';
  @Input() placeholder = 'Selecione...';

  @Input() disabled = false;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Input() searchable = true;

  @Input() allowNull = false;
  @Input() nullLabel = '— Nenhum —';

  @Input() showReload = false;
  @Output() reload = new EventEmitter<void>();

  @Input() value: T | null = null;
  @Output() valueChange = new EventEmitter<T | null>();

  @Input() options: UiSelectOption<T>[] = [];

  open = signal(false);
  pos = signal({ left: 0, top: 0, width: 0 });

  q = '';
  filtered = signal<UiSelectOption<T>[]>([]);

  ngOnInit() {
    this.applyFilter();
  }

  ngOnChanges() {
    this.applyFilter();
  }

  private computeAnchorPos() {
    const el = this.anchor?.nativeElement ?? this.host.nativeElement.querySelector('button');
    if (!el) return;

    const r = el.getBoundingClientRect();
    const left = r.left;
    const width = r.width;

    const preferBelow = r.bottom + 320 <= window.innerHeight;
    const top = preferBelow ? r.bottom + 6 : Math.max(8, r.top - 6 - 320);

    this.pos.set({ left, top, width });
  }

  toggleOpen() {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.computeAnchorPos();
    this.applyFilter();
    this.open.set(true);
  }

  closeFromBackdrop(ev: MouseEvent) {
    ev.stopPropagation();
    this.open.set(false);
  }

  applyFilter() {
    const term = lower(this.q).trim();
    const src = Array.isArray(this.options) ? this.options : [];

    if (!this.searchable || !term) {
      this.filtered.set(src);
      return;
    }

    this.filtered.set(
      src.filter((o) => {
        const a = lower(o.label);
        const b = lower(o.subLabel);
        return a.includes(term) || b.includes(term);
      }),
    );
  }

  pick(opt: UiSelectOption<T>) {
    this.valueChange.emit(opt.value);
    this.open.set(false);
  }

  pickNull() {
    this.valueChange.emit(null);
    this.open.set(false);
  }

  selectedOption(): UiSelectOption<T> | null {
    const v = this.value;
    for (const o of this.options ?? []) {
      if (o.value === v) return o;
    }
    return null;
  }

  selectedLabel(): string | null {
    return this.selectedOption()?.label ?? null;
  }

  selectedSubLabel(): string | null {
    return this.selectedOption()?.subLabel ?? null;
  }

  selectedIcon(): string | null {
    return this.selectedOption()?.iconUrl ?? null;
  }

  trackKey(opt: UiSelectOption<T>) {
    return `${lower(opt.label)}:${String(opt.value)}`;
  }
}
