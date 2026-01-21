import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

type Roles = 'none' | 'readonly' | 'admin';
const rank: Record<Roles, number> = { none: 0, readonly: 1, admin: 2 };

export const roleGuard = (minRole: Roles): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    return auth.bootstrap().pipe(
      take(1),
      map(() => {
        const user = auth.userSig();
        if (!user) return router.parseUrl('/login');
        if (rank[user.scope] >= rank[minRole]) return true;
        return router.parseUrl('/');
      }),
    );
  };
};
