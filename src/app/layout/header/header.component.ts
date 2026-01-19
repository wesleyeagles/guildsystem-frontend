import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-header',
  template: `
    <header class="h-16 w-full px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div class="font-semibold">Projeto</div>

      <div class="flex items-center gap-3">
        <div class="text-sm text-slate-300">{{ userLabel() }}</div>
        <button class="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600" (click)="logout()">
          Sair
        </button>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  private auth = inject(AuthService);

  userLabel = computed(() => {
    const u = this.auth.userSig();
    return u ? `${u.email} • ${u.scope}` : '';
  });

  logout() {
    this.auth.logout().subscribe();
  }
}
