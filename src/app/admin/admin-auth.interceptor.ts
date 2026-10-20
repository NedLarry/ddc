import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BOOKING_API_BASE } from '../booking/booking.config';
import { AdminAuthService } from './admin-auth.service';

/**
 * Adds the staff token to admin API calls, and signs out on a 401 so an
 * expired session lands back on the sign-in page instead of a broken table.
 */
export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(BOOKING_API_BASE);
  const isAdminCall = req.url.startsWith(`${base}/admin/`);
  const isSignIn = req.url === `${base}/admin/session`;
  if (!isAdminCall || isSignIn) {
    return next(req);
  }

  const auth = inject(AdminAuthService);
  const router = inject(Router);
  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.signOut(router.url);
      }
      return throwError(() => error);
    })
  );
};
