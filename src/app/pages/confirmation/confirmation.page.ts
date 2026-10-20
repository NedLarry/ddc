import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BookingService } from '../../booking/services/booking.service';
import { buildIcs, formatSlotLong } from '../../booking/services/booking.time';

/**
 * Shown straight after a successful booking. Reads the receipt from
 * BookingService state; after a reload that state is gone, so it points
 * the visitor at the status page instead.
 */
@Component({
  selector: 'dc-confirmation-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="dc-page">
      <div class="dc-container dc-container--narrow">
        @if (receipt(); as r) {
          <div class="tick" aria-hidden="true"></div>
          <span class="dc-eyebrow dc-eyebrow--dark">
            {{ r.kind === 'consultation' ? 'Call booked' : 'Request sent' }}
          </span>
          <h1 class="dc-page-title">Thank you. We've got it.</h1>
          <p class="dc-page-lede" role="status">{{ r.message }}</p>

          <dl class="dc-card facts">
            <div>
              <dt>Your reference</dt>
              <dd class="ref">{{ r.reference }}</dd>
            </div>
            @if (slotLabel(); as when) {
              <div>
                <dt>Call time</dt>
                <dd>{{ when }}</dd>
              </div>
            }
          </dl>
          <p class="hint">Keep the reference. With your email, it lets you check this booking any time.</p>

          <div class="actions">
            @if (r.slot) {
              <button type="button" class="dc-btn dc-btn--primary" (click)="downloadIcs()">Add to calendar</button>
            }
            <a class="dc-btn dc-btn--ghost" routerLink="/status" [queryParams]="{ ref: r.reference }">Check status</a>
            <a class="dc-btn dc-btn--ghost" routerLink="/">Back to home</a>
          </div>
        } @else {
          <h1 class="dc-page-title">Nothing to confirm here</h1>
          <p class="dc-page-lede">
            This page shows a booking straight after it's made. If you've already booked,
            look it up with your reference and email.
          </p>
          <div class="actions">
            <a class="dc-btn dc-btn--primary" routerLink="/status">Check a booking</a>
            <a class="dc-btn dc-btn--ghost" routerLink="/book/consultation">Book a call</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dc-eyebrow--dark { color: var(--dc-muted); }
    .tick {
      width: 44px; height: 44px; margin-bottom: 26px; background: var(--dc-ink);
      display: grid; place-items: center;
    }
    .tick::after {
      content: ''; width: 16px; height: 9px; margin-top: -4px;
      border-left: 3px solid var(--dc-paper); border-bottom: 3px solid var(--dc-paper);
      transform: rotate(-45deg);
    }
    .facts { margin: 0; display: grid; gap: 20px; }
    .facts dt { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: var(--dc-muted); }
    .facts dd { margin: 4px 0 0; font-size: 18px; font-weight: bold; }
    .facts .ref { font-family: var(--dc-font-ui); font-variant-numeric: tabular-nums; font-size: 26px; letter-spacing: 1px; }
    .hint { font-size: 14px; color: var(--dc-muted); margin: 14px 0 32px; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  `],
})
export class ConfirmationPage {
  private readonly booking = inject(BookingService);

  protected readonly receipt = this.booking.receipt;

  protected readonly slotLabel = computed(() => {
    const slot = this.receipt()?.slot;
    return slot ? formatSlotLong(slot.start, slot.timezone) : null;
  });

  protected downloadIcs(): void {
    const r = this.receipt();
    if (!r?.slot) return;

    const ics = buildIcs({
      uid: r.reference,
      start: r.slot.start,
      minutes: 30,
      title: 'Consultation call — Diadem Consults',
      description: `Booking reference ${r.reference}. A meeting link will follow by email.`,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `diadem-call-${r.reference}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
