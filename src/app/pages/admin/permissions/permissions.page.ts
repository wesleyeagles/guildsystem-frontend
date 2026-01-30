import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsersApi, type Roles, type SafeUser } from '../../../api/users.api';
import { AuthService } from '../../../auth/auth.service';
import { UiSpinnerComponent } from '../../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../../ui/toast/toast.service';

function asStr(v: any) {
  return String(v ?? '').trim();
}

function normRole(v: any): Roles {
  const s = asStr(v);
  if (s === 'none' || s === 'readonly' || s === 'moderator' || s === 'admin' || s === 'root') return s;
  return 'readonly';
}

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

@Component({
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent],
  templateUrl: './permissions.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsPage {
  private api = inject(UsersApi);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  loading = signal(false);
  error = signal('');

  query = signal('');

  list = signal<SafeUser[]>([]);
  updating = signal<Record<number, boolean>>({});

  page = signal(1);
  pageSize = signal<number>(25);
  readonly pageSizes = [10, 25, 50, 100] as const;

  readonly me = computed(() => this.auth.userSig());
  readonly myScope = computed(() => (this.me()?.scope ?? null) as Roles | null);

  readonly roles: Roles[] = ['none', 'readonly', 'moderator', 'admin', 'root'];

  readonly filtered = computed(() => {
    const q = asStr(this.query()).toLowerCase();
    const arr = this.list();

    const base = arr.slice().sort((a, b) => {
      const aa = asStr(a.nickname).toLowerCase();
      const bb = asStr(b.nickname).toLowerCase();
      if (aa < bb) return -1;
      if (aa > bb) return 1;
      return a.id - b.id;
    });

    if (!q) return base;

    return base.filter((u) => {
      return (
        asStr(u.nickname).toLowerCase().includes(q) ||
        asStr(u.email).toLowerCase().includes(q) ||
        String(u.id).includes(q)
      );
    });
  });

  readonly totalPages = computed(() => {
    const total = this.filtered().length;
    const ps = this.pageSize();
    return Math.max(1, Math.ceil(total / ps));
  });

  readonly paged = computed(() => {
    const tp = this.totalPages();
    const p = Math.min(Math.max(1, this.page()), tp);
    const ps = this.pageSize();
    const start = (p - 1) * ps;
    const end = start + ps;
    return this.filtered().slice(start, end);
  });

  fmtDateTimePtBR = fmtDateTimePtBR;

  constructor() {
    this.load();
  }

  onSearchChange(v: string) {
    this.query.set(v);
    this.page.set(1);
  }

  onChangePageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  prevPage() {
    const p = this.page();
    if (p <= 1) return;
    this.page.set(p - 1);
  }

  nextPage() {
    const p = this.page();
    const tp = this.totalPages();
    if (p >= tp) return;
    this.page.set(p + 1);
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.list().subscribe({
      next: (arr) => {
        this.list.set(arr ?? []);
        const tp = this.totalPages();
        const p = Math.min(Math.max(1, this.page()), tp);
        this.page.set(p);
      },
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar usuários'),
      complete: () => this.loading.set(false),
    });
  }

  private canSetRole(actorScope: Roles | null, actorId: number, target: SafeUser, desired: Roles) {
    if (!actorScope) return false;
    if (actorId === target.id) return false;

    const targetScope = normRole((target as any).scope);
    const isTargetRoot = String((target as any).scope) === 'root';

    if (isTargetRoot) return false;
    if (desired === 'root') return false;

    if (actorScope === 'root') {
      return desired === 'none' || desired === 'readonly' || desired === 'moderator' || desired === 'admin';
    }

    if (actorScope === 'admin') {
      if (targetScope === 'admin') return false;
      if (targetScope === 'none') return false;

      const canTouch = targetScope === 'readonly' || targetScope === 'moderator';
      if (!canTouch) return false;

      return desired === 'readonly' || desired === 'moderator';
    }

    return false;
  }

  private canToggleOffModerator(actorScope: Roles | null, actorId: number, target: SafeUser) {
    const targetScope = normRole((target as any).scope);
    if (actorScope !== 'admin') return false;
    if (actorId === target.id) return false;
    if (targetScope !== 'moderator') return false;
    return this.canSetRole(actorScope, actorId, target, 'readonly');
  }

  isChecked(u: SafeUser, r: Roles) {
    return normRole((u as any).scope) === r;
  }

  isDisabled(u: SafeUser, r: Roles) {
    const me = this.me();
    const actorScope = this.myScope();
    const actorId = me?.userId ?? -1;

    if (this.updating()[u.id]) return true;

    const checked = this.isChecked(u, r);

    if (checked) {
      if (r === 'moderator') {
        return !this.canToggleOffModerator(actorScope, actorId, u);
      }
      return true;
    }

    return !this.canSetRole(actorScope, actorId, u, r);
  }

  toggleRole(u: SafeUser, r: Roles, ev: Event) {
    const input = ev?.target as HTMLInputElement | null;
    const checked = Boolean(input?.checked);

    const actorScope = this.myScope();
    const actorId = this.me()?.userId ?? -1;

    const current = normRole((u as any).scope);
    const wanted = normRole(r);

    if (checked) {
      if (this.isDisabled(u, wanted)) return;
      if (current === wanted) return;
      return this.applyRole(u, wanted);
    }

    if (current === 'moderator' && wanted === 'moderator') {
      if (!this.canToggleOffModerator(actorScope, actorId, u)) return;
      return this.applyRole(u, 'readonly');
    }

    return;
  }

  private applyRole(u: SafeUser, nextRole: Roles) {
    const prevRole = normRole((u as any).scope);
    if (prevRole === nextRole) return;

    this.updating.set({ ...this.updating(), [u.id]: true });

    this.api.updateScope(u.id, nextRole).subscribe({
      next: (updated) => {
        this.list.set(this.list().map((x) => (x.id === u.id ? updated : x)));
        this.toast.success(
          `Permissão de ${u.nickname}: ${prevRole} → ${normRole((updated as any).scope)}`,
        );
      },
      error: (e) => {
        this.toast.error(e?.error?.message ?? 'Falha ao atualizar permissão');
      },
      complete: () => {
        const cur = { ...this.updating() };
        delete cur[u.id];
        this.updating.set(cur);
      },
    });
  }
}
