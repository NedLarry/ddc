import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { BOOKING_API_BASE } from '../booking/booking.config';
import { BookingRecord, BookingStatus } from '../booking/models/booking.models';

/** Staff-side reads and writes. Auth is added by adminAuthInterceptor. */
@Injectable({ providedIn: 'root' })
export class AdminBookingsService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${inject(BOOKING_API_BASE)}/admin/bookings`;

  list(): Observable<BookingRecord[]> {
    return this.http.get<BookingRecord[]>(this.endpoint);
  }

  updateStatus(reference: string, status: BookingStatus): Observable<BookingRecord> {
    return this.http.patch<BookingRecord>(`${this.endpoint}/${encodeURIComponent(reference)}`, { status });
  }
}
