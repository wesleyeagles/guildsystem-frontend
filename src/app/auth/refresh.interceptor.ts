import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

let refreshing = false;

export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: any) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);

      const is401 = err.status === 401;
      const isApi = req.url.startsWith(environment.apiUrl);
      const isRefreshCall = req.url.includes('/auth/refresh');
      const isLoginRegister = req.url.includes('/auth/login') || req.url.includes('/auth/register');

      if (!isApi || !is401 || isRefreshCall || isLoginRegister) {
        return throwError(() => err);
      }

      if (refreshing) {
        // simples: se já está refreshando, manda pro login (pode evoluir pra fila/retry)
        auth.setAccessToken(null);
        return throwError(() => err);
      }

      refreshing = true;
      return auth.refresh().pipe(
        switchMap(() => {
          refreshing = false;
          // reenvia a request original (authInterceptor vai anexar o novo token)
          return next(req);
        }),
        catchError((e) => {
          refreshing = false;
          auth.setAccessToken(null);
          return throwError(() => e);
        }),
      );
    }),
  );
};
