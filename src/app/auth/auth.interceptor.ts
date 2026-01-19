import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isApi = req.url.startsWith(environment.apiUrl);
  if (!isApi) return next(req);

  const token = auth.accessToken();
  const isAuthRoute = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh');

  const cloned = req.clone({
    withCredentials: true, // importante pra cookies
    setHeaders: !isAuthRoute && token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(cloned);
};
