import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { BOOKING_API_BASE } from '../booking/booking.config';

const TOKEN_KEY = 'dc.admin.token';

/**
 * Staff session for the admin dashboard. The token lives in sessionStorage,
 * so it ends when the tab closes.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiBase = inject(BOOKING_API_BASE);

  private readonly _token = signal<string | null>(readToken());

  readonly token = this._token.asReadonly();
  readonly isSignedIn = computed(() => this._token() !== null);

  signIn(passcode: string): Observable<void> {
    return this.http
      .post<{ token: string }>(`${this.apiBase}/admin/session`, { passcode })
      .pipe(
        tap(({ token }) => {
          writeToken(token);
          this._token.set(token);
        }),
        map(() => undefined)
      );
  }

  /** Clears the session and sends the viewer to the sign-in page. */
  signOut(returnTo?: string): void {
    writeToken(null);
    this._token.set(null);
    void this.router.navigate(['/admin/login'], {
      queryParams: returnTo ? { next: returnTo } : {},
    });
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked — the in-memory signal still holds the session.
  }
}
