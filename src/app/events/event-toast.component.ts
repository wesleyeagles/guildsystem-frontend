import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslocoService } from '@jsverse/transloco';
import { EventsApi } from '../api/events.api';
import { ToastService } from '../ui/toast/toast.service';
import { EventToastManager } from './event-toast.manager';
import {
  EVENT_TOAST_DATA,
  EVENT_TOAST_REF,
  type EventToastData,
  EventToastRef,
} from './event-toast.tokens';

const TZ_BRASILIA = 'America/Sao_Paulo';

function msLeft(expiresAtIso: string) {
  return new Date(expiresAtIso).getTime() - Date.now();
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function fmtDateTimeBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';

  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ_BRASILIA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);

  return `${date} ${time}`;
}

function isImageFile(file: File) {
  return Boolean(file?.type?.startsWith('image/'));
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './event-toast.component.html',
  styleUrl: './event-toast.component.scss',
})
export class EventToastComponent implements AfterViewInit, OnDestroy {
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  private manager = inject(EventToastManager);
  private destroyRef = inject(DestroyRef);

  data = inject<EventToastData>(EVENT_TOAST_DATA);
  ref = inject<EventToastRef>(EVENT_TOAST_REF);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('pwInput') pwInput?: ElementRef<HTMLInputElement>;

  password = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  // ✅ espelho reativo do form control para signals
  private pwValue = signal<string>('');
  private pwValid = signal<boolean>(false);

  hasPilot = signal(false);
  file = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  dragging = signal(false);

  submitting = signal(false);
  error = signal('');

  private tick = signal(0);
  private timer: number | null = null;
  private onPasteBound = (e: ClipboardEvent) => this.onPaste(e);

  pilotBonus = computed(() => Number(this.data.pilotBonusPoints ?? 0) || 0);
  pilotEligible = computed(() => this.pilotBonus() > 0);

  pilotTotal = computed(() => this.data.points + this.pilotBonus());

  expired = computed(() => msLeft(this.data.expiresAt) <= 0);

  timeLeftLabel = computed(() => {
    this.tick();
    return fmtCountdown(msLeft(this.data.expiresAt));
  });

  expiresAtLabel = computed(() => {
    this.tick();
    return fmtDateTimeBR(this.data.expiresAt);
  });

  submitDisabled = computed(() => {
    // ✅ depende de signals => agora recalcula
    const _pw = this.pwValue();
    const pwOk = this.pwValid();

    if (this.submitting()) return true;
    if (this.expired()) return true;
    if (!pwOk) return true;

    if (this.hasPilot() && !this.pilotEligible()) return true;

    if (this.hasPilot() && !this.file()) return true;

    return false;
  });

  constructor() {
    this.pwValue.set(this.password.value ?? '');
    this.pwValid.set(this.password.valid);

    this.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.pwValue.set(String(v ?? '')));

    this.password.statusChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.pwValid.set(this.password.valid));

    if (Number(this.data.pilotBonusPoints ?? 0) <= 0) {
      this.hasPilot.set(false);
    }

    this.timer = window.setInterval(() => {
      this.tick.update((v) => v + 1);
      if (msLeft(this.data.expiresAt) <= 0) this.ref.dismiss();
    }, 1000);

    window.addEventListener('paste', this.onPasteBound);
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      try {
        this.pwInput?.nativeElement?.focus();
      } catch {
        // ignore
      }
    });
  }

  ngOnDestroy() {
    if (this.timer) window.clearInterval(this.timer);
    window.removeEventListener('paste', this.onPasteBound);
    this.revokePreview();
  }

  close() {
    this.ref.dismiss();
  }

  togglePilot(e: any) {
    if (!this.pilotEligible()) return;

    const next = Boolean(e?.target?.checked);
    this.hasPilot.set(next);
    this.error.set('');
    if (!next) this.clearFile();
  }

  pickFile() {
    if (!this.pilotEligible()) return;
    if (this.submitting() || this.expired()) return;

    if (!this.hasPilot()) this.hasPilot.set(true);
    this.fileInput?.nativeElement?.click();
  }

  onFilePicked(e: any) {
    if (!this.pilotEligible()) return;

    const input = e?.target as HTMLInputElement | undefined;
    const f = input?.files?.[0] ?? null;
    if (!f) return;
    this.setFile(f);
    if (input) input.value = '';
  }

  clearFile() {
    this.file.set(null);
    this.revokePreview();
  }

  onDragEnter(e: DragEvent) {
    if (!this.pilotEligible()) return;
    e.preventDefault();
    e.stopPropagation();
    if (this.submitting() || this.expired()) return;
    if (!this.hasPilot()) this.hasPilot.set(true);
    this.dragging.set(true);
  }

  onDragLeave(e: DragEvent) {
    if (!this.pilotEligible()) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragging.set(false);
  }

  onDragOver(e: DragEvent) {
    if (!this.pilotEligible()) return;
    e.preventDefault();
    e.stopPropagation();
    if (this.submitting() || this.expired()) return;
    if (!this.hasPilot()) this.hasPilot.set(true);
    this.dragging.set(true);
  }

  onDrop(e: DragEvent) {
    if (!this.pilotEligible()) return;
    e.preventDefault();
    e.stopPropagation();
    this.dragging.set(false);
    if (this.submitting() || this.expired()) return;

    const f = e.dataTransfer?.files?.[0] ?? null;
    if (!f) return;
    this.setFile(f);
  }

  private onPaste(e: ClipboardEvent) {
    if (!this.pilotEligible()) return;
    if (this.submitting() || this.expired()) return;

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    for (const it of Array.from(items)) {
      if (it.kind !== 'file') continue;
      const f = it.getAsFile();
      if (!f) continue;
      if (!isImageFile(f)) continue;

      if (!this.hasPilot()) this.hasPilot.set(true);
      this.setFile(f);
      break;
    }
  }

  private setFile(f: File) {
    this.error.set('');

    if (!isImageFile(f)) {
      this.error.set('Arquivo inválido. Envie uma imagem.');
      return;
    }

    this.file.set(f);
    this.setPreview(f);
  }

  private setPreview(f: File) {
    this.revokePreview();
    try {
      const url = URL.createObjectURL(f);
      this.previewUrl.set(url);
    } catch {
      this.previewUrl.set(null);
    }
  }

  private revokePreview() {
    const url = this.previewUrl();
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    this.previewUrl.set(null);
  }

  prettySize(bytes: number) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  submit() {
    this.error.set('');
    if (this.submitDisabled()) return;

    const pw = this.password.value;
    const wantsPilot = this.hasPilot();

    this.submitting.set(true);

    const obs = wantsPilot
      ? this.api.claimPilot(this.data.id, pw, this.file()!)
      : this.api.claim(this.data.id, pw);

    obs.subscribe({
      next: (r: any) => {
        this.manager.markClaimed(this.data.id);

        const pending = Boolean(r?.pending);
        const added = Number(r?.pointsAdded ?? 0) || 0;

        if (pending) {
          this.toast.success(this.transloco.translate('toast.sentApproval'));
        } else {
          this.toast.success(this.transloco.translate('toast.pointsReceived', { n: added }));
        }

        this.ref.dismissWithAction();
      },
      error: (e) => {
        this.error.set(e?.error?.message ?? this.transloco.translate('toast.claimPasswordFail'));
        this.submitting.set(false);
      },
      complete: () => this.submitting.set(false),
    });
  }
}
