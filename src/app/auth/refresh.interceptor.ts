import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from './auth.service';

function isAuthEndpoint(url: string) {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/register');
}

export const refreshInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn,
): Observable<HttpEvent<any>> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ anexa bearer se tiver token
  const token = auth.accessToken();
  const authReq =
    token && !isAuthEndpoint(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: any) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      // ✅ se refresh/login/register falhar com 401 => limpa e manda pro login
      if (err.status === 401 && isAuthEndpoint(req.url)) {
        auth.clearSession();
        router.navigateByUrl('/login');
        return throwError(() => err);
      }

      // ✅ se não tem token, não tenta refresh
      if (err.status !== 401 || !auth.accessToken()) {
        return throwError(() => err);
      }

      // ✅ evita loop infinito: se a request já foi retriada, não tenta de novo
      const alreadyRetried = req.headers.get('x-refresh-retried') === '1';
      if (alreadyRetried) {
        auth.clearSession();
        router.navigateByUrl('/login');
        return throwError(() => err);
      }

      // ✅ tenta refresh e reexecuta a request original com novo token
      return auth.refresh().pipe(
        switchMap(() => {
          const newToken = auth.accessToken();
          if (!newToken) {
            auth.clearSession();
            router.navigateByUrl('/login');
            return throwError(() => err);
          }

          const retryReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`,
              'x-refresh-retried': '1',
            },
          });

          return next(retryReq);
        }),
        catchError((e) => {
          auth.clearSession();
          router.navigateByUrl('/login');
          return throwError(() => e);
        }),
      );
    }),
  );
};
