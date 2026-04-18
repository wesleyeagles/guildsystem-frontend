import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';

import { EventsApi, type PendingPilotClaimItem } from '../../../api/events.api';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '../../../ui/toast/toast.service';

import { RejectReasonDialogComponent } from './reject-reason-dialog/reject-reason.dialog';
import { PilotImageDialogComponent } from './pilot-image-dialog/pilot-image.dialog';

import { environment } from '../../../../environments/environment';

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function trimSlashRight(s: string) {
  return String(s ?? '').replace(/\/+$/, '');
}

function trimSlashLeft(s: string) {
  return String(s ?? '').replace(/^\/+/, '');
}

@Component({
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './events-pilot-approvals.page.html',
  styleUrl: './events-pilot-approvals.page.scss',
})
export class EventsPilotApprovalsPage {
  private destroyRef = inject(DestroyRef);
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  private dialog = inject(Dialog);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  // base da API p/ imagens
  private apiBase = trimSlashRight(environment.apiUrl);

  loading = signal(false);

  q = signal('');
  page = signal(1);
  pageSize = signal(12);

  total = signal(0);
  totalPages = signal(1);

  items = signal<PendingPilotClaimItem[]>([]);

  // UI state
  approving = signal<Record<number, boolean>>({});
  rejecting = signal<Record<number, boolean>>({});

  empty = computed(() => !this.loading() && (this.items()?.length ?? 0) === 0);

  constructor() {
    this.load();
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);

    this.api
      .pendingPilotClaims({
        page: this.page(),
        pageSize: this.pageSize(),
        q: this.q().trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.items.set(r.items ?? []);
          this.total.set(asInt(r.total, 0));
          this.totalPages.set(Math.max(1, asInt(r.totalPages, 1)));
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.pendingLoadFail')),
        complete: () => this.loading.set(false),
      });
  }

  onSearch(v: string) {
    this.q.set(v ?? '');
    this.page.set(1);
    this.load();
  }

  prevPage() {
    const p = this.page();
    if (p <= 1) return;
    this.page.set(p - 1);
    this.load();
  }

  nextPage() {
    const p = this.page();
    const tp = this.totalPages();
    if (p >= tp) return;
    this.page.set(p + 1);
    this.load();
  }

  /**
   * ✅ garante que a imagem sempre venha do backend (environment.apiUrl)
   * - se vier absoluta (http/https), mantém
   * - se vier relativa (/uploads/..), prefixa com apiUrl
   */
  imageUrl(path: string | null | undefined) {
    const p = String(path ?? '').trim();
    if (!p) return null;

    if (/^https?:\/\//i.test(p)) return p; // já absoluta

    // relativa => usa API_BASE
    return `${this.apiBase}/${trimSlashLeft(p)}`;
  }

  openImage(it: PendingPilotClaimItem) {
    const src = this.imageUrl(it.pilotImagePath);
    if (!src) return;

    this.dialog.open(PilotImageDialogComponent, {
      data: {
        src,
        title: it.event?.title ?? this.transloco.translate('eventsClaims.imageTitle'),
        subtitle: this.transloco.translate('eventsPilot.imageSubtitle', {
          nick: it.user?.nickname ?? '—',
          id: it.claimId,
        }),
      },
    });
  }

  approve(it: PendingPilotClaimItem) {
    const claimId = it.claimId;
    if (!claimId) return;

    this.approving.update((m) => ({ ...m, [claimId]: true }));

    this.api
      .approvePilotClaim(claimId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r: any) => {
          const pts = asInt(r?.pointsAdded, 0);
          this.toast.success(
            pts
              ? this.transloco.translate('toast.approvedWithPts', { pts })
              : this.transloco.translate('toast.approved'),
          );
          this.removeFromList(claimId);
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.approveFail')),
        complete: () => {
          this.approving.update((m) => {
            const copy = { ...m };
            delete copy[claimId];
            return copy;
          });
        },
      });
  }

  reject(it: PendingPilotClaimItem) {
    const claimId = it.claimId;
    if (!claimId) return;

    const ref = this.dialog.open(RejectReasonDialogComponent, { data: { claimId } });

    ref.closed.subscribe((res: any) => {
      if (!res || res?.ok !== true) return;

      const reason = (res.reason ?? null) as string | null;

      this.rejecting.update((m) => ({ ...m, [claimId]: true }));

      this.api
        .rejectPilotClaim(claimId, reason)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toast.success(this.transloco.translate('toast.rejected'));
            this.removeFromList(claimId);
          },
          error: (e) =>
            this.toast.error(e?.error?.message ?? this.transloco.translate('toast.rejectFail')),
          complete: () => {
            this.rejecting.update((m) => {
              const copy = { ...m };
              delete copy[claimId];
              return copy;
            });
          },
        });
    });
  }

  busy(it: PendingPilotClaimItem) {
    const id = it.claimId;
    return Boolean(this.approving()[id] || this.rejecting()[id]);
  }

  meta(it: PendingPilotClaimItem) {
    void this.langTick();
    const base = asInt(it.event?.points, 0);
    const bonus = asInt(it.event?.pilotBonusPoints, 0);
    const total = base + bonus;

    return {
      base,
      bonus,
      total,
      createdAtLabel: it.createdAt ? this.formatClaimDate(it.createdAt) : '-',
      nickname: it.user?.nickname ?? '—',
      eventTitle: it.event?.title ?? '—',
    };
  }

  trackByClaimId = (_: number, it: PendingPilotClaimItem) => it.claimId;

  private formatClaimDate(iso: string | null | undefined) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    void this.langTick();
    const lang = this.transloco.getActiveLang();
    const loc = lang === 'pt-BR' ? 'pt-BR' : lang === 'ru' ? 'ru-RU' : 'en-US';
    return d.toLocaleString(loc);
  }

  private removeFromList(claimId: number) {
    this.items.update((arr) => (arr ?? []).filter((x) => x.claimId !== claimId));
    this.total.update((t) => Math.max(0, (asInt(t, 0) || 0) - 1));
  }
}
