import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UsersApi, type SafeUser } from '../../api/users.api';
import { UiSpinnerComponent } from '../../ui/spinner/ui-spinner.component';
import { ToastService } from '../../ui/toast/toast.service';

function fmtDateTimePtBR(isoOrDate: any) {
  if (!isoOrDate) return '—';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

@Component({
  standalone: true,
  imports: [CommonModule, UiSpinnerComponent],
  templateUrl: './pending-members.page.html',
})
export class PendingMembersPage {
  private api = inject(UsersApi);
  private toast = inject(ToastService);

  list = signal<SafeUser[]>([]);
  loading = signal(false);
  error = signal('');

  acceptingId = signal<number | null>(null);

  fmtDateTimePtBR = fmtDateTimePtBR;

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');

    this.api.pending().subscribe({
      next: (arr) => this.list.set(arr ?? []),
      error: (e) => this.error.set(e?.error?.message ?? 'Falha ao carregar pendentes'),
      complete: () => this.loading.set(false),
    });
  }

  accept(u: SafeUser) {
    this.acceptingId.set(u.id);

    this.api.accept(u.id).subscribe({
      next: () => {
        this.toast.success(`Usuário ${u.nickname} aceito!`);
        this.list.update((arr) => arr.filter((x) => x.id !== u.id));
      },
      error: (e) => this.toast.error(e?.error?.message ?? 'Falha ao aceitar usuário'),
      complete: () => this.acceptingId.set(null),
    });
  }
}
