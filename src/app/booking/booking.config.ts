import { InjectionToken } from '@angular/core';

/**
 * Base URL for the booking API. Defaults to `/api`; override it in
 * app.config.ts when the backend lives elsewhere:
 *
 *   { provide: BOOKING_API_BASE, useValue: 'https://api.diadem-consults.com' }
 */
export const BOOKING_API_BASE = new InjectionToken<string>('BOOKING_API_BASE', {
  providedIn: 'root',
  factory: () => '/api',
});
