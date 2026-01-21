import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-header',
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private auth = inject(AuthService);

  // ✅ pega o usuário do AuthService (computed no service)
  user = computed(() => this.auth.userSig());

  logout() {
    this.auth.logout().subscribe();
  }
}
