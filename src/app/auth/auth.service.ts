import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { tap, catchError, of, finalize, shareReplay, mapTo, Observable } from 'rxjs';

type Roles = 'none' | 'readonly' | 'moderator' | 'admin' | 'root';

export type SafeUser = {
  id: number;
  email: string;
  scope: Roles;
  points: number;
  nickname: string;
  characterClass: string;
  accepted: boolean;
  hasConfirmedSiteNickname: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
  discordId?: string | null;
  discordUsername?: string | null;
  discordDiscriminator?: string | null;
  discordAvatar?: string | null;
  profileAvatar?: string | null;
  discordLinkedAt?: string | null;
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

  private safeUserSigInternal = signal<SafeUser | null>(this.readSafeUserFromStorage());
  readonly safeUserSig = computed(() => this.safeUserSigInternal());


  private userSigInternal = signal<JwtUser | null>(this.readUserFromStorage());
  readonly userSig = computed(() => this.userSigInternal());

  private readSafeUserFromStorage(): SafeUser | null {
    const raw = sessionStorage.getItem('safeUser');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SafeUser;
    } catch {
      sessionStorage.removeItem('safeUser');
      return null;
    }
  }

  readonly isAuthenticated = computed(() => !!this.accessTokenSig());
  readonly accessToken = computed(() => this.accessTokenSig());

  private readySig = signal(false);
  private bootingSig = signal(false);

  readonly ready = computed(() => this.readySig());
  readonly booting = computed(() => this.bootingSig());

  private bootstrap$?: Observable<null>;

  constructor(private http: HttpClient, private router: Router) {}

  user() {
    return this.userSigInternal();
  }

  token() {
    return this.accessTokenSig();
  }

  authed() {
    return !!this.accessTokenSig();
  }

  bootstrap(): Observable<null> {
    if (this.readySig()) return of(null);
    if (this.bootstrap$) return this.bootstrap$;

    this.bootingSig.set(true);

    this.bootstrap$ = this.refresh().pipe(
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
      mapTo(null),
      finalize(() => {
        this.bootingSig.set(false);
        this.readySig.set(true);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.bootstrap$;
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

   private saveSafeUserToStorage(user: SafeUser | null) {
    if (!user) {
      sessionStorage.removeItem('safeUser');
      return;
    }
    sessionStorage.setItem('safeUser', JSON.stringify(user));
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

  private setSession(accessToken: string | null, safeUser: SafeUser | null) {
    this.accessTokenSig.set(accessToken);

    if (accessToken) sessionStorage.setItem('accessToken', accessToken);
    else sessionStorage.removeItem('accessToken');

    this.safeUserSigInternal.set(safeUser);
    this.saveSafeUserToStorage(safeUser);


    const jwt = safeUser ? this.toJwtUser(safeUser) : null;
    this.userSigInternal.set(jwt);
    this.saveUserToStorage(jwt);
  }

  clearSession() {
    this.setSession(null, null);
  }

  register(payload: { email: string; nickname: string; password: string }) {
    return this.http.post<{ registered: boolean; accepted: boolean }>(
      `${environment.apiUrl}/auth/register`,
      payload,
      { withCredentials: true },
    );
  }

  login(payload: { email: string; password: string }) {
    return this.http
      .post<{ accessToken: string; user: SafeUser }>(`${environment.apiUrl}/auth/login`, payload, {
        withCredentials: true,
      })
      .pipe(tap((r) => this.setSession(r.accessToken, r.user)));
  }

  refresh() {
    return this.http
      .post<{ accessToken: string; user: SafeUser }>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(tap((r) => this.setSession(r.accessToken, r.user)));
  }

  meStrict() {
    return this.http.get<SafeUser>(`${environment.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      tap((u) => this.setSession(this.accessTokenSig(), u)),
    );
  }

  me() {
    return this.meStrict().pipe(
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  logout() {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearSession();
        this.router.navigateByUrl('/login');
      }),
    );
  }

  startDiscordLogin() {
    const base = String(environment.apiUrl).replace(/\/+$/, '');
    window.location.href = `${base}/auth/discord`;
  }

  handleDiscordCallbackFromHash(hash: string) {
    const h = String(hash ?? '').replace(/^#/, '');
    const sp = new URLSearchParams(h);

    const error = sp.get('error');
    if (error) {
      return { ok: false as const, error };
    }

    const accessToken = sp.get('accessToken');
    if (!accessToken) {
      return { ok: false as const, error: 'missing_accessToken' };
    }

    this.accessTokenSig.set(accessToken);
    sessionStorage.setItem('accessToken', accessToken);

    return { ok: true as const };
  }

  setPoints(points: number) {
    const u = this.userSigInternal();
    if (!u) return;
    const next = { ...u, points };
    this.userSigInternal.set(next);
    this.saveUserToStorage(next);
  }

  /** Atualiza o usuário logado no estado (ex.: após alterar nickname). */
  setSafeUser(user: SafeUser) {
    const token = this.accessTokenSig();
    if (token) this.setSession(token, user);
  }
}
