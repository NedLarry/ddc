import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  BOOKING_STATUS_FLOW,
  BOOKING_STATUS_LABELS,
  BookingStatusView,
} from '../../booking/models/booking.models';
import { BookingService } from '../../booking/services/booking.service';
import { firstErrorMessage, notBlank, strictEmail } from '../../booking/services/booking.validators';
import { formatDateTime, formatSlotLong, localTimezone } from '../../booking/services/booking.time';

@Component({
  selector: 'dc-status-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="dc-page">
      <div class="dc-container dc-container--narrow">
        <span class="dc-eyebrow dc-eyebrow--dark">Your booking</span>
        <h1 class="dc-page-title">Check a booking</h1>
        <p class="dc-page-lede">Enter the reference from your confirmation and the email you booked with.</p>

        <form [formGroup]="form" (ngSubmit)="lookup()" novalidate class="lookup">
          <label class="dc-field">
            <span>Reference</span>
            <input type="text" formControlName="reference" placeholder="DC-8F2K1A"
                   autocapitalize="characters" spellcheck="false" class="mono"
                   [attr.aria-invalid]="!!err('reference', 'Reference')" />
            @if (err('reference', 'Reference'); as m) { <em class="dc-field-error">{{ m }}</em> }
          </label>
          <label class="dc-field">
            <span>Email</span>
            <input type="email" formControlName="email" autocomplete="email"
                   [attr.aria-invalid]="!!err('email', 'Email')" />
            @if (err('email', 'Email'); as m) { <em class="dc-field-error">{{ m }}</em> }
          </label>
          <button class="dc-btn dc-btn--primary" type="submit" [disabled]="loading()">
            {{ loading() ? 'Looking…' : 'Find booking' }}
          </button>
        </form>

        @if (error(); as e) {
          <p class="dc-alert dc-alert--error" role="alert">{{ e }}</p>
        }

        @if (result(); as b) {
          <section class="dc-card result" aria-live="polite">
            <header class="result__head">
              <div>
                <span class="mono result__ref">{{ b.reference }}</span>
                <h2>{{ b.kind === 'consultation' ? 'Consultation call' : b.requestName }}</h2>
              </div>
              <span class="dc-badge dc-badge--{{ b.status }}">{{ labels[b.status] }}</span>
            </header>

            @if (b.status === 'cancelled') {
              <p class="dc-alert dc-alert--info">
                This booking was cancelled. If that's unexpected, reply to your confirmation email
                or <a routerLink="/book/consultation">book a new time</a>.
              </p>
            } @else {
              <ol class="flow">
                @for (step of flow(); track step; let i = $index) {
                  <li [class.is-done]="i < stepIndex()" [class.is-current]="i === stepIndex()"
                      [attr.aria-current]="i === stepIndex() ? 'step' : null">
                    {{ labels[step] }}
                  </li>
                }
              </ol>
            }

            <dl class="result__facts">
              @if (b.slot) {
                <div><dt>Call time</dt><dd>{{ slotLabel(b) }}</dd></div>
              }
              <div><dt>Booked by</dt><dd>{{ b.displayName }}</dd></div>
              <div><dt>Submitted</dt><dd>{{ when(b.submittedAt) }}</dd></div>
              <div><dt>Last update</dt><dd>{{ when(b.updatedAt) }}</dd></div>
            </dl>
          </section>
        }
      </div>
    </div>
  `,
  styles: [`
    .dc-eyebrow--dark { color: var(--dc-muted); }
    .mono { font-family: var(--dc-font-ui); font-variant-numeric: tabular-nums; letter-spacing: .5px; }
    .lookup { display: grid; grid-template-columns: 1fr 1.4fr auto; gap: 0 14px; align-items: start; }
    .lookup .dc-btn { margin-top: 27px; }

    .result { margin-top: 32px; }
    .result__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
    .result__ref { font-size: 13px; color: var(--dc-muted); }
    .result__head h2 { font-size: 22px; margin-top: 4px; }

    .flow { list-style: none; margin: 0 0 24px; padding: 0; display: flex; }
    .flow li {
      flex: 1; position: relative; padding-top: 18px; font-size: 13px; color: var(--dc-muted);
    }
    .flow li::before {
      content: ''; position: absolute; top: 0; left: 0; right: 4px; height: 6px; background: var(--dc-line-light);
    }
    .flow li.is-done::before { background: var(--dc-navy); }
    .flow li.is-current::before { background: var(--dc-ink); }
    .flow li.is-current { color: var(--dc-ink); font-weight: bold; }

    .result__facts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }
    .result__facts dt { font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--dc-muted); }
    .result__facts dd { margin: 3px 0 0; font-size: 15px; }

    @media (max-width: 640px) {
      .lookup { grid-template-columns: 1fr; }
      .lookup .dc-btn { margin-top: 0; width: 100%; }
      .result__facts { grid-template-columns: 1fr; }
      .flow { flex-direction: column; gap: 10px; }
      .flow li { padding: 0 0 0 18px; }
      .flow li::before { top: 2px; bottom: 2px; right: auto; width: 6px; height: auto; }
    }
  `],
})
export class StatusPage implements OnInit {
  /** Pre-fills the reference from `?ref=` (e.g. the confirmation page link). */
  readonly ref = input<string>();

  private readonly booking = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly labels = BOOKING_STATUS_LABELS;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<BookingStatusView | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    reference: ['', [Validators.required, notBlank(), Validators.pattern(/^\s*DC-?[A-Za-z0-9]{6}\s*$/i)]],
    email: ['', [Validators.required, notBlank(), strictEmail()]],
  });

  protected readonly flow = computed(() => {
    const r = this.result();
    return r ? BOOKING_STATUS_FLOW[r.kind] : [];
  });

  protected readonly stepIndex = computed(() => {
    const r = this.result();
    return r ? this.flow().indexOf(r.status) : -1;
  });

  ngOnInit(): void {
    const ref = this.ref();
    if (ref) this.form.controls.reference.setValue(ref);
  }

  protected err(name: 'reference' | 'email', label: string): string | null {
    const control = this.form.controls[name];
    if (name === 'reference' && control.touched && control.hasError('pattern')) {
      return 'References look like DC-8F2K1A.';
    }
    return firstErrorMessage(control, label);
  }

  protected lookup(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { reference, email } = this.form.getRawValue();
    const normalisedRef = reference.trim().toUpperCase().replace(/^DC-?/, 'DC-');

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.booking
      .lookupStatus(normalisedRef, email)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (view) => this.result.set(view),
        error: (e: HttpErrorResponse) =>
          this.error.set(
            e.status === 404
              ? "We couldn't find a booking with that reference and email. Check both and try again."
              : e.status === 0
                ? 'Could not reach the server. Check your connection and try again.'
                : 'Something went wrong. Try again shortly.'
          ),
      });
  }

  protected slotLabel(b: BookingStatusView): string {
    return b.slot ? formatSlotLong(b.slot.start, localTimezone()) : '';
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
