import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-header',
  template: `
    <header class="h-16 w-full px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full overflow-hidden">
      <img src="/logo.png" alt="">
      </div>
      <div class="font-semibold">BlackList</div>
</div>

      <div class="flex items-center gap-3">
        @if (user()) {
          <div class="text-sm text-slate-300">
             {{ user()?.nickname }} • <b>{{ user()!.points }}</b> pts
          </div>
        } @else {
          <div class="text-sm text-slate-500">—</div>
        }

        <button class="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600" (click)="logout()">
          Sair
        </button>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  private auth = inject(AuthService);

  // ✅ pega o usuário do AuthService (computed no service)
  user = computed(() => this.auth.userSig());

  logout() {
    this.auth.logout().subscribe();
  }
}
