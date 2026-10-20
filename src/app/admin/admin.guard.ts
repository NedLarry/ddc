import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AdminAuthService } from './admin-auth.service';

/** Keeps signed-out visitors out of the dashboard. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  return auth.isSignedIn()
    ? true
    : inject(Router).createUrlTree(['/admin/login'], { queryParams: { next: state.url } });
};
