import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';

import { EventsApi, type PublicClaimItem, type ClaimStatus } from '../../../api/events.api';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '../../../ui/toast/toast.service';

import { PilotImageDialogComponent } from '../events-pilot-approvals/pilot-image-dialog/pilot-image.dialog';
import { environment } from '../../../../environments/environment';

type Tab = 'ALL' | ClaimStatus;

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
  templateUrl: './events-claims.page.html',
  styleUrl: './events-claims.page.scss',
})
export class EventsClaimsPage {
  private destroyRef = inject(DestroyRef);
  private api = inject(EventsApi);
  private toast = inject(ToastService);
  private transloco = inject(TranslocoService);
  private dialog = inject(Dialog);
  private readonly langTick = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private apiBase = trimSlashRight(environment.apiUrl);

  loading = signal(false);

  q = signal('');
  tab = signal<Tab>('ALL');

  page = signal(1);
  pageSize = signal(12);

  total = signal(0);
  totalPages = signal(1);

  items = signal<PublicClaimItem[]>([]);

  empty = computed(() => !this.loading() && (this.items()?.length ?? 0) === 0);

  constructor() {
    this.load();
  }

  load() {
    if (this.loading()) return;
    this.loading.set(true);

    this.api
      .claimsPublic({
        page: this.page(),
        pageSize: this.pageSize(),
        q: this.q().trim() || undefined,
        status: this.tab(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.items.set(r.items ?? []);
          this.total.set(asInt(r.total, 0));
          this.totalPages.set(Math.max(1, asInt(r.totalPages, 1)));
        },
        error: (e) =>
          this.toast.error(e?.error?.message ?? this.transloco.translate('toast.claimsLoadFail')),
        complete: () => this.loading.set(false),
      });
  }

  setTab(t: Tab) {
    this.tab.set(t);
    this.page.set(1);
    this.load();
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

  imageUrl(path: string | null | undefined) {
    const p = String(path ?? '').trim();
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${this.apiBase}/${trimSlashLeft(p)}`;
  }

  openImage(it: PublicClaimItem) {
    const src = this.imageUrl(it.pilotImagePath);
    if (!src) return;

    const who = it.user?.nickname ?? `ID ${it.user?.userId ?? '—'}`;

    this.dialog.open(PilotImageDialogComponent, {
      data: {
        src,
        title: it.event?.title ?? this.transloco.translate('eventsClaims.imageTitle'),
        subtitle: `${who} • Claim #${it.claimId}`,
      },
    });
  }

  private formatClaimDate(iso: string | null | undefined) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    void this.langTick();
    const lang = this.transloco.getActiveLang();
    const loc = lang === 'pt-BR' ? 'pt-BR' : lang === 'ru' ? 'ru-RU' : 'en-US';
    return d.toLocaleString(loc);
  }

  badge(it: PublicClaimItem) {
    void this.langTick();
    const s = it.status;
    if (s === 'APPROVED') return { label: this.transloco.translate('eventsClaims.approved'), cls: 'st st--ok' };
    if (s === 'REJECTED') return { label: this.transloco.translate('eventsClaims.rejected'), cls: 'st st--bad' };
    return { label: this.transloco.translate('eventsClaims.statusPendingShort'), cls: 'st st--pend' };
  }

  meta(it: PublicClaimItem) {
    void this.langTick();
    const base = asInt(it.event?.points, 0);
    const bonus = asInt(it.event?.pilotBonusPoints, 0);
    const total = base + bonus;

    return {
      base,
      bonus,
      total,
      createdAtLabel: it.createdAt ? this.formatClaimDate(it.createdAt) : '-',
      approvedAtLabel: it.approvedAt ? this.formatClaimDate(it.approvedAt) : null,
      rejectedAtLabel: it.rejectedAt ? this.formatClaimDate(it.rejectedAt) : null,
      pointsGranted: it.pointsGranted != null ? asInt(it.pointsGranted, 0) : null,
      userNickname: it.user?.nickname ?? '—',
      userId: it.user?.userId ?? 0,
      eventTitle: it.event?.title ?? '—',
    };
  }

  trackByClaimId = (_: number, it: PublicClaimItem) => it.claimId;
}
