import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UsersApi, type PublicUserProfile, type UserEventHistoryPaged } from '../../../api/users.api';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { UiPagerComponent } from '../../../ui/pagination/ui-pager.component';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { discordAvatarUrl } from '../../../utils/discord-avatar';

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function asStr(v: any) {
  return String(v ?? '').trim();
}

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

@Component({
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent, UiPagerComponent, LucideAngularModule],
  templateUrl: './member-details.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberDetailsPage {
  private api = inject(UsersApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly BackIcon = ArrowLeft;

  userId = signal<number>(0);

  loading = signal(false);
  error = signal('');

  profile = signal<PublicUserProfile | null>(null);

  historyLoading = signal(false);
  historyError = signal('');

  q = signal('');
  private q$ = new Subject<string>();

  page = signal(1);
  pageSize = signal(15);
  readonly pageSizes = [10, 15, 25, 50] as const;

  history = signal<UserEventHistoryPaged | null>(null);

  readonly title = computed(() => {
    const p = this.profile();
    if (!p) return 'Membro';
    return asStr(p.user.nickname) || `Membro #${p.user.id}`;
  });

  readonly email = computed(() => asStr(this.profile()?.user.email) || '—');
  readonly nickname = computed(() => asStr(this.profile()?.user.nickname) || '—');
  readonly roleLabel = computed(() => {
    const s = asStr(this.profile()?.user.scope);
    if (s === 'readonly') return 'Membro';
    if (s === 'moderator') return 'Moderador';
    if (s === 'admin') return 'Admin';
    if (s === 'root') return 'Root';
    if (s === 'none') return 'Nenhum';
    return 'Membro';
  });

  readonly points = computed(() => {
    const v = (this.profile()?.user as any)?.points;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly totalRegistered = computed(() => {
    const v = (this.profile()?.stats as any)?.totalRegistered;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly totalSpent = computed(() => {
    const v = (this.profile()?.stats as any)?.totalSpent;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly warnings = computed(() => {
    const v = (this.profile()?.stats as any)?.warnings;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });

  readonly lastLoginAt = computed(() => fmtDateTimePtBR(this.profile()?.stats?.lastLoginAt ?? null));

  readonly avatarUrl = computed(() => {
    const u: any = this.profile()?.user as any;
    return discordAvatarUrl(
      {
        discordId: u?.discordId ?? null,
        discordAvatar: u?.discordAvatar ?? null,
        discordDiscriminator: u?.discordDiscriminator ?? null,
      },
      96,
    );
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => {
      const id = asInt(m.get('id'), 0);
      if (!id || id <= 0) {
        this.router.navigateByUrl('/');
        return;
      }
      this.userId.set(id);
      this.page.set(1);
      this.loadProfile();
      this.loadHistory();
    });

    this.q$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap((v) => {
          this.q.set(v);
          this.page.set(1);
        }),
        switchMap(() => {
          return of(null).pipe(
            tap(() => this.loadHistory()),
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  back() {
    history.back();
  }

  onSearchChange(v: string) {
    this.q$.next(String(v ?? ''));
  }

  onChangePageSize(n: number) {
    this.pageSize.set(n);
    this.page.set(1);
    this.loadHistory();
  }

  prevPage() {
    const p = this.page();
    if (p <= 1) return;
    this.page.set(p - 1);
    this.loadHistory();
  }

  nextPage() {
    const tp = this.history()?.totalPages ?? 1;
    const p = this.page();
    if (p >= tp) return;
    this.page.set(p + 1);
    this.loadHistory();
  }

  loadProfile() {
    const id = this.userId();
    if (!id) return;

    this.loading.set(true);
    this.error.set('');

    this.api.publicProfile(id).subscribe({
      next: (p) => this.profile.set(p ?? null),
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar perfil'),
      complete: () => this.loading.set(false),
    });
  }

  loadHistory() {
    const id = this.userId();
    if (!id) return;

    this.historyLoading.set(true);
    this.historyError.set('');

    this.api
      .publicEventHistory(id, { page: this.page(), pageSize: this.pageSize(), q: asStr(this.q()) || undefined })
      .subscribe({
        next: (res) => this.history.set(res ?? null),
        error: (e) => this.historyError.set(e?.error?.message ?? 'Falha ao carregar histórico'),
        complete: () => this.historyLoading.set(false),
      });
  }

  fmtDateTimePtBR = fmtDateTimePtBR;
}
