import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';

type Roles = 'none' | 'readonly' | 'admin';

export type SafeUser = {
  id: number;
  email: string;
  scope: Roles;
  points: number;
  nickname: string;
  accepted: boolean;
  createdAt: string; // ou Date, dependendo do seu client
  updatedAt: string; // ou Date
};

export type JwtUser = {
  userId: number;
  email: string;
  scope: Roles;
  points: number;
  nickname: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessTokenSig = signal<string | null>(sessionStorage.getItem('accessToken'));

  // ✅ persiste user separado (não depende do JWT)
  private userSigInternal = signal<JwtUser | null>(this.readUserFromStorage());
  userSig = computed(() => this.userSigInternal());

  isAuthenticated = computed(() => !!this.accessTokenSig());
  accessToken = computed(() => this.accessTokenSig());

  constructor(private http: HttpClient, private router: Router) {
    // ✅ se tem token mas não tem user (ex: mudou versão), tenta carregar do /auth/me
    if (this.accessTokenSig() && !this.userSigInternal()) {
      this.me().subscribe();
    }
  }

  private readUserFromStorage(): JwtUser | null {
    const raw = sessionStorage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JwtUser;
    } catch {
      sessionStorage.removeItem('user');
      return null;
    }
  }

  private saveUserToStorage(user: JwtUser | null) {
    if (!user) {
      sessionStorage.removeItem('user');
      return;
    }
    sessionStorage.setItem('user', JSON.stringify(user));
  }

  private toJwtUser(u: SafeUser): JwtUser {
    return {
      userId: u.id,
      email: u.email,
      scope: u.scope,
      points: u.points,
      nickname: u.nickname,
    };
  }

  private setSession(accessToken: string | null, user: JwtUser | null) {
    this.accessTokenSig.set(accessToken);

    if (accessToken) sessionStorage.setItem('accessToken', accessToken);
    else sessionStorage.removeItem('accessToken');

    this.userSigInternal.set(user);
    this.saveUserToStorage(user);
  }

  clearSession() {
    this.setSession(null, null);
  }

  // ✅ agora register NÃO retorna token
  register(payload: { email: string; nickname: string; password: string }) {
    return this.http.post<{ registered: boolean; accepted: boolean }>(
      `${environment.apiUrl}/auth/register`,
      payload,
      { withCredentials: true },
    );
  }

  // ✅ login agora retorna accessToken + user
  login(payload: { email: string; password: string }) {
    return this.http
      .post<{ accessToken: string; user: SafeUser }>(
        `${environment.apiUrl}/auth/login`,
        payload,
        { withCredentials: true },
      )
      .pipe(
        tap((r) => this.setSession(r.accessToken, this.toJwtUser(r.user))),
      );
  }

  // ✅ refresh agora retorna accessToken + user
  refresh() {
    return this.http
      .post<{ accessToken: string; user: SafeUser }>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((r) => this.setSession(r.accessToken, this.toJwtUser(r.user))),
      );
  }

  // ✅ endpoint pra reidratar user (points) a qualquer momento
  me() {
    return this.http
      .get<SafeUser>(`${environment.apiUrl}/auth/me`, { withCredentials: true })
      .pipe(
        tap((u) => {
          // mantém token atual e atualiza só o user
          this.setSession(this.accessTokenSig(), this.toJwtUser(u));
        }),
        catchError((_e) => {
          // se falhar (token inválido), limpa sessão
          this.clearSession();
          return of(null);
        }),
      );
  }

  logout() {
    return this.http
      .post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigateByUrl('/login');
        }),
      );
  }

  // ✅ helper pra atualizar points localmente (ex: websocket de leilão)
  setPoints(points: number) {
    const u = this.userSigInternal();
    if (!u) return;
    const next = { ...u, points }; 
    this.userSigInternal.set(next);
    this.saveUserToStorage(next);
  }
}
