import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { AUTH_RETURN_KEY } from './auth-return-url';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.bootstrap().pipe(
    take(1),
    map(() => {
      if (!auth.authed()) {
        sessionStorage.setItem(AUTH_RETURN_KEY, state.url);
        return router.createUrlTree(['/login']);
      }

      if (auth.safeUserSig()?.accepted === false) {
        return router.createUrlTree(['/waiting-acceptance']);
      }

      return true;
    }),
  );
};
