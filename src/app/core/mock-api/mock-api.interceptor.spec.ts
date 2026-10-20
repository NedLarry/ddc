import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Availability, BookingReceipt, BookingStatusView } from '../../booking/models/booking.models';
import { MOCK_API_LATENCY, mockApiInterceptor } from './mock-api.interceptor';

/** Resolves to the error the observable fails with. */
async function failure(source: Observable<unknown>): Promise<HttpErrorResponse> {
  try {
    await firstValueFrom(source);
  } catch (e) {
    return e as HttpErrorResponse;
  }
  throw new Error('Expected the request to fail');
}

describe('mockApiInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    // Node 26 exposes a global localStorage that is undefined without
    // --localstorage-file; the store falls back to memory in that case.
    globalThis.localStorage?.removeItem('dc.mock.bookings.v1');
    globalThis.sessionStorage?.removeItem('dc.mock.adminToken');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockApiInterceptor])),
        { provide: MOCK_API_LATENCY, useValue: () => 0 },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  async function firstOpenSlot(): Promise<string> {
    const availability = await firstValueFrom(http.get<Availability>('/api/availability'));
    return availability.slots.find((s) => s.available)!.start;
  }

  function book(start: string, email = 'ada@example.com'): Observable<BookingReceipt> {
    return http.post<BookingReceipt>('/api/bookings', {
      kind: 'consultation',
      clientType: 'person',
      name: 'Ada Lovelace',
      email,
      phone: '+2348012345678',
      slot: { start, timezone: 'Europe/London' },
    });
  }

  it('books a free slot and returns a reference', async () => {
    const receipt = await firstValueFrom(book(await firstOpenSlot()));
    expect(receipt.reference).toMatch(/^DC-[A-Z0-9]{6}$/);
    expect(receipt.status).toBe('pending');
  });

  it('refuses the same slot twice with a 409', async () => {
    const start = await firstOpenSlot();
    await firstValueFrom(book(start));
    const error = await failure(book(start, 'someone.else@example.com'));
    expect(error.status).toBe(409);
  });

  it('marks a booked slot unavailable', async () => {
    const start = await firstOpenSlot();
    await firstValueFrom(book(start));
    const availability = await firstValueFrom(http.get<Availability>('/api/availability'));
    expect(availability.slots.find((s) => s.start === start)?.available).toBe(false);
  });

  it('rejects a bad email with a 422 and a message', async () => {
    const error = await failure(book(await firstOpenSlot(), 'not-an-email'));
    expect(error.status).toBe(422);
    expect(error.error.message).toContain('email');
  });

  it('only reveals status to the matching email', async () => {
    const { reference } = await firstValueFrom(book(await firstOpenSlot()));

    const view = await firstValueFrom(
      http.get<BookingStatusView>('/api/bookings/status', { params: { reference, email: 'ada@example.com' } })
    );
    expect(view.status).toBe('pending');

    const wrongEmail = await failure(
      http.get('/api/bookings/status', { params: { reference, email: 'eve@example.com' } })
    );
    expect(wrongEmail.status).toBe(404);
  });

  it('guards admin routes behind a session token', async () => {
    const unauthorised = await failure(http.get('/api/admin/bookings'));
    expect(unauthorised.status).toBe(401);

    const { token } = await firstValueFrom(
      http.post<{ token: string }>('/api/admin/session', { passcode: environment.mockAdminPasscode })
    );
    const records = await firstValueFrom(
      http.get<unknown[]>('/api/admin/bookings', { headers: { Authorization: `Bearer ${token}` } })
    );
    expect(records.length).toBeGreaterThan(0); // seeded samples
  });

  it('only accepts statuses from the booking kind\'s flow', async () => {
    const { token } = await firstValueFrom(
      http.post<{ token: string }>('/api/admin/session', { passcode: environment.mockAdminPasscode })
    );
    const headers = { Authorization: `Bearer ${token}` };

    // DC-T2H9XE is a seeded request; 'confirmed' belongs to consultations.
    const error = await failure(http.patch('/api/admin/bookings/DC-T2H9XE', { status: 'confirmed' }, { headers }));
    expect(error.status).toBe(422);

    const updated = await firstValueFrom(
      http.patch<{ status: string }>('/api/admin/bookings/DC-T2H9XE', { status: 'scheduled' }, { headers })
    );
    expect(updated.status).toBe('scheduled');
  });
});
