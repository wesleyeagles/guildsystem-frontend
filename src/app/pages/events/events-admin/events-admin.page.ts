import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { EventsApi, EventDefinition, type EventInstance, type EventCategory } from '../../../api/events.api';
import { EventToastManager } from '../../../events/event-toast.manager';
import { ToastService } from '../../../ui/toast/toast.service';
import { ButtonComponent } from '../../../components/button/button.component';

type Duration = 15 | 30 | 45 | 60;
type AdminTab = 'active' | 'ended' | 'cancelled' | 'all';

function isEnded(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}
function isCancelled(ev: EventInstance) {
  return Boolean((ev as any).isCanceled) || Boolean(ev.canceledAt);
}
function isActive(ev: EventInstance) {
  return !isCancelled(ev) && !isEnded(ev.expiresAt);
}

function isCancellable(ev: EventInstance) {
  return (isActive(ev) || isEnded(ev.expiresAt) && !isCancelled(ev));
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: './events-admin.page.html',
})
export class EventsAdminPage {
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private eventsManager = inject(EventToastManager);

  // defs + create event
  definitions = signal<EventDefinition[]>([]);
  loadingDefs = signal(false);
  defsError = signal('');

  creating = signal(false);
  createError = signal('');

  form = new FormGroup({
    definitionCode: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    durationMinutes: new FormControl<Duration>(15, { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    isDoubled: new FormControl<boolean>(false, { nonNullable: true }),
  });

  selectedDef = computed(() => {
    const code = this.form.controls.definitionCode.value;
    return this.definitions().find((d) => d.code === code) ?? null;
  });

  previewPoints = computed(() => {
    const d = this.selectedDef();
    if (!d) return 0;
    return this.form.controls.isDoubled.value ? d.points * 2 : d.points;
  });

  // create definition
  creatingDef = signal(false);
  defError = signal('');

  endDate(ev: EventInstance) { return new Date(ev.expiresAt).toLocaleDateString('pt-BR') + ' ' + new Date(ev.expiresAt).toLocaleTimeString('pt-BR'); }

  defForm = new FormGroup({
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    title: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    points: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    category: new FormControl<EventCategory>('GENERIC', { nonNullable: true, validators: [Validators.required] }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  // events list
  events = signal<EventInstance[]>([]);
  loadingEvents = signal(false);
  eventsError = signal('');

  tab = signal<AdminTab>('active');

  filteredEvents = computed(() => {
    const t = this.tab();
    const list = this.events();

    const filtered =
      t === 'all'
        ? list
        : t === 'active'
          ? list.filter(isActive)
          : t === 'ended'
            ? list.filter((e) => !isCancelled(e) && isEnded(e.expiresAt))
            : list.filter(isCancelled);

    return [...filtered].sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());
  });

  // cancel modal
  cancelModalOpen = signal(false);
  cancelTarget = signal<EventInstance | null>(null);
  cancelReason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] });
  canceling = signal(false);
  cancelError = signal('');

  constructor() {
    this.loadDefinitions();
    this.loadEvents();
  }

  isActiveRow(ev: EventInstance) { return isActive(ev); }
  isCancelledRow(ev: EventInstance) { return isCancelled(ev); }
  isCancellableRow(ev: EventInstance) { return isCancellable(ev); }

  loadDefinitions() {
    this.loadingDefs.set(true);
    this.defsError.set('');
    this.api.definitions().subscribe({
      next: (list) => this.definitions.set(list ?? []),
      error: (e) => this.defsError.set(e?.error?.message ?? 'Falha ao carregar lista de eventos'),
      complete: () => this.loadingDefs.set(false),
    });
  }

  reset() {
    this.createError.set('');
    this.form.reset({ definitionCode: '', durationMinutes: 15, password: '', isDoubled: false });
  }

  submit() {
    this.createError.set('');
    if (this.form.invalid || this.creating()) return;

    const payload = this.form.getRawValue();
    this.creating.set(true);

    this.api.create(payload as any).subscribe({
      next: (r: any) => {
        this.toast.success(`Evento criado: ${r?.title ?? 'OK'} (+${r?.points ?? '?'} pts)`);
        this.eventsManager.push({ id: r.id, title: r.title, points: r.points, expiresAt: r.expiresAt });
        this.reset();
        this.loadEvents();
      },
      error: (e) => {
        const msg = e?.error?.message ?? 'Falha ao criar evento';
        this.createError.set(msg);
        this.toast.error(msg);
      },
      complete: () => this.creating.set(false),
    });
  }

  resetDefinition() {
    this.defError.set('');
    this.defForm.reset({ code: '', title: '', points: 0, category: 'GENERIC', isActive: true });
  }

  submitDefinition() {
    this.defError.set('');
    if (this.defForm.invalid || this.creatingDef()) return;

    const payload = this.defForm.getRawValue();
    this.creatingDef.set(true);

    this.api.createDefinition(payload).subscribe({
      next: (def) => {
        this.toast.success(`Definition criada: ${def.code} (${def.title})`);
        this.resetDefinition();
        this.loadDefinitions();
      },
      error: (e) => {
        const msg = e?.error?.message ?? 'Falha ao criar definition';
        this.defError.set(msg);
        this.toast.error(msg);
      },
      complete: () => this.creatingDef.set(false),
    });
  }

  loadEvents() {
    this.loadingEvents.set(true);
    this.eventsError.set('');
    this.api.listAdmin().subscribe({
      next: (list) => this.events.set(list ?? []),
      error: (e) => this.eventsError.set(e?.error?.message ?? 'Falha ao carregar eventos'),
      complete: () => this.loadingEvents.set(false),
    });
  }

  copyId(id: number) {
    navigator.clipboard?.writeText(String(id));
    this.toast.success('ID copiado!');
  }

  openCancel(ev: EventInstance) {
    this.cancelTarget.set(ev);
    this.cancelReason.reset('');
    this.cancelError.set('');
    this.cancelModalOpen.set(true);
  }

  closeCancel(force = false) {
    if (!force && this.canceling()) return;
    this.cancelModalOpen.set(false);
    this.cancelTarget.set(null);
  }

  confirmCancel() {
    const ev = this.cancelTarget();
    if (!ev) return;
    if (this.cancelReason.invalid || this.canceling()) return;

    this.canceling.set(true);
    this.cancelError.set('');

    this.api.cancel(ev.id, this.cancelReason.value).subscribe({
      next: () => {
        this.canceling.set(false);
        this.toast.success('Evento cancelado.');
        this.closeCancel(true);
        this.loadEvents();
      },
      error: (e) => {
        this.cancelError.set(e?.error?.message ?? 'Falha ao cancelar evento');
      },
      complete: () => this.canceling.set(false),
    });
  }
}
