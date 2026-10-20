import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { BookingFormComponent } from '../../booking/booking-form.component';
import { BookingKind } from '../../booking/models/booking.models';

@Component({
  selector: 'dc-book-page',
  standalone: true,
  imports: [RouterLink, BookingFormComponent],
  template: `
    <div class="dc-page">
      <div class="dc-container book">
        <div class="book__main">
          <span class="dc-eyebrow dc-eyebrow--dark">Book with us</span>
          <h1 class="dc-page-title">
            {{ kind() === 'consultation' ? 'Book a consultation call' : 'Make a technology request' }}
          </h1>
          <p class="dc-page-lede">
            @if (kind() === 'consultation') {
              Choose a time, tell us who you are, and we'll confirm the call by email.
            } @else {
              Describe what you need in a few sentences. We'll reply with next steps.
            }
          </p>

          <nav class="dc-toggle" aria-label="Booking type">
            <a routerLink="/book/consultation" [class.is-active]="kind() === 'consultation'"
               [attr.aria-current]="kind() === 'consultation' ? 'page' : null">Consultation call</a>
            <a routerLink="/book/request" [class.is-active]="kind() === 'request'"
               [attr.aria-current]="kind() === 'request' ? 'page' : null">Technology request</a>
          </nav>

          <dc-booking-form [kind]="kind()" (submitted)="onSubmitted()" />
        </div>

        <aside class="book__aside">
          <div class="dc-card">
            <h2>What happens next</h2>
            <ol>
              @if (kind() === 'consultation') {
                <li>You get a booking reference straight away.</li>
                <li>We confirm the call by email within one business day.</li>
                <li>We send a meeting link before the call.</li>
              } @else {
                <li>You get a booking reference straight away.</li>
                <li>We review the request and reply within one business day.</li>
                <li>If it's a fit, we follow up with a scope and quote.</li>
              }
            </ol>
            <p>
              Already booked? <a routerLink="/status">Check a booking</a>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .book { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 56px; align-items: start; }
    .book__main { max-width: 640px; }
    .dc-eyebrow--dark { color: var(--dc-muted); }
    .book__aside { position: sticky; top: 24px; margin-top: 110px; }
    .book__aside h2 { font-size: 17px; margin-bottom: 14px; }
    .book__aside ol { margin: 0 0 18px; padding-left: 18px; font-size: 14px; color: var(--dc-muted); }
    .book__aside li + li { margin-top: 8px; }
    .book__aside p { margin: 0; font-size: 14px; }

    @media (max-width: 900px) {
      .book { grid-template-columns: 1fr; gap: 32px; }
      .book__aside { position: static; margin-top: 0; }
    }
  `],
})
export class BookPage {
  /** Bound from route data. */
  readonly kind = input<BookingKind>('consultation');

  private readonly router = inject(Router);

  protected onSubmitted(): void {
    void this.router.navigate(['/book/confirmed']);
  }
}
