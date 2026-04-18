import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const moderationGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.bootstrap().pipe(
    take(1),
    map(() => {
      const u = auth.user();
      if (u?.scope === 'moderator' || u?.scope === 'admin' || u?.scope === 'root') return true;
      return router.createUrlTree(['/']);
    }),
  );
};
