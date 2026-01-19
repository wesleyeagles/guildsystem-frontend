import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

type Roles = 'none' | 'readonly' | 'admin';
type JwtUser = { userId: number; email: string; scope: Roles };

function decodeJwt(token: string): any {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessTokenSig = signal<string | null>(sessionStorage.getItem('accessToken'));
  userSig = signal<JwtUser | null>(this.accessTokenSig() ? this.userFromToken(this.accessTokenSig()!) : null);

  isAuthenticated = computed(() => !!this.accessTokenSig());
  accessToken = computed(() => this.accessTokenSig());

  constructor(private http: HttpClient, private router: Router) {}

  private userFromToken(token: string): JwtUser {
    const p = decodeJwt(token);
    return { userId: p.sub, email: p.email, scope: p.scope };
  }

  setAccessToken(token: string | null) {
    this.accessTokenSig.set(token);
    if (token) {
      sessionStorage.setItem('accessToken', token);
      this.userSig.set(this.userFromToken(token));
    } else {
      sessionStorage.removeItem('accessToken');
      this.userSig.set(null);
    }
  }

  // ✅ agora register NÃO retorna token
  register(payload: { email: string; nickname: string; password: string }) {
    return this.http.post<{ registered: boolean; accepted: boolean }>(
      `${environment.apiUrl}/auth/register`,
      payload,
      { withCredentials: true },
    );
  }

  login(payload: { email: string; password: string }) {
    return this.http
      .post<{ accessToken: string }>(`${environment.apiUrl}/auth/login`, payload, { withCredentials: true })
      .pipe(tap((r) => this.setAccessToken(r.accessToken)));
  }

  refresh() {
    return this.http
      .post<{ accessToken: string }>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap((r) => this.setAccessToken(r.accessToken)));
  }

  logout() {
    return this.http
      .post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.setAccessToken(null);
          this.router.navigateByUrl('/login');
        }),
      );
  }
}
