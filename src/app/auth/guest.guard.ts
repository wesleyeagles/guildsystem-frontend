import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const guestGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.bootstrap().pipe(
    take(1),
    map(() => {
      if (!auth.authed()) return true;

      const path = state.url.split('?')[0];
      if (auth.safeUserSig()?.accepted === false) {
        if (path === '/waiting-acceptance' || path.startsWith('/auth/discord')) {
          return true;
        }
        return router.parseUrl('/waiting-acceptance');
      }

      return router.parseUrl('/');
    }),
  );
};
