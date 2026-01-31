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

function isLoginEndpoint(url: string) {
  return url.includes('/auth/login');
}

function isRegisterEndpoint(url: string) {
  return url.includes('/auth/register');
}

function isRefreshEndpoint(url: string) {
  return url.includes('/auth/refresh');
}

function isAnyAuthEndpoint(url: string) {
  return isLoginEndpoint(url) || isRegisterEndpoint(url) || isRefreshEndpoint(url);
}

export const refreshInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn,
): Observable<HttpEvent<any>> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.accessToken();
  const authReq =
    token && !isAnyAuthEndpoint(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: any) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      if (isRefreshEndpoint(req.url)) {
        if (err.status === 401) {
          auth.clearSession();
          return throwError(() => err);
        }

        if (err.status === 403) {
          auth.clearSession();
          router.navigateByUrl('/waiting-acceptance');
          return throwError(() => err);
        }
      }

      if ((isLoginEndpoint(req.url) || isRegisterEndpoint(req.url)) && err.status === 401) {
        auth.clearSession();
        router.navigateByUrl('/login');
        return throwError(() => err);
      }

      if (err.status !== 401 || !auth.accessToken()) {
        return throwError(() => err);
      }

      const alreadyRetried = req.headers.get('x-refresh-retried') === '1';
      if (alreadyRetried) {
        auth.clearSession();
        router.navigateByUrl('/login');
        return throwError(() => err);
      }

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
        catchError((e: any) => {
          if (e instanceof HttpErrorResponse) {
            if (e.status === 403) {
              auth.clearSession();
              router.navigateByUrl('/waiting-acceptance');
              return throwError(() => e);
            }
          }

          auth.clearSession();
          router.navigateByUrl('/login');
          return throwError(() => e);
        }),
      );
    }),
  );
};
