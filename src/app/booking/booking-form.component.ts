import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { BookingError, BookingService, BOOKING_LIMITS } from './services/booking.service';
import { firstErrorMessage } from './services/booking.validators';
import { localTimezone } from './services/booking.time';
import {
  AvailabilitySlot,
  BookingKind,
  BookingReceipt,
  ClientType,
  SlotSelection,
} from './models/booking.models';
import { SlotPickerComponent } from './slot-picker.component';

/**
 * The booking flows: a consultation call (pick a slot, then person or
 * business details) or a technological request.
 *
 * Which flow shows is set by the `kind` input. On success the forms reset
 * and `submitted` emits the receipt — the host decides where to go next.
 */
@Component({
  selector: 'dc-booking-form',
  standalone: true,
  imports: [ReactiveFormsModule, SlotPickerComponent],
  template: `
    @if (kind() === 'consultation') {
      <form (submit)="$event.preventDefault(); submitConsultation()" novalidate>
        <fieldset class="bf-step">
          <legend><span class="bf-num">1</span> Pick a time</legend>
          <dc-slot-picker
            [formControl]="slotControl"
            [slots]="slots()"
            [slotMinutes]="slotMinutes()"
            [state]="slotsState()"
            (retry)="loadAvailability()" />
          @if (slotControl.touched && slotControl.invalid) {
            <em class="dc-field-error">Choose a time for your call.</em>
          }
        </fieldset>

        <fieldset class="bf-step">
          <legend><span class="bf-num">2</span> Your details</legend>

          <div class="dc-toggle dc-toggle--sub" role="group" aria-label="Who is booking">
            <button
              type="button"
              [class.is-active]="clientType() === 'person'"
              [attr.aria-pressed]="clientType() === 'person'"
              (click)="setClientType('person')">
              I'm an individual
            </button>
            <button
              type="button"
              [class.is-active]="clientType() === 'business'"
              [attr.aria-pressed]="clientType() === 'business'"
              (click)="setClientType('business')">
              I'm a business
            </button>
          </div>

          @if (clientType() === 'person') {
            <div [formGroup]="personForm">
              <label class="dc-field">
                <span>Full name</span>
                <input type="text" formControlName="name" autocomplete="name"
                       [attr.maxlength]="limits.name.max"
                       [attr.aria-invalid]="!!err(personForm, 'name', 'Name')" />
                @if (err(personForm, 'name', 'Name'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>

              <label class="dc-field">
                <span>Email</span>
                <input type="email" formControlName="email" autocomplete="email"
                       [attr.aria-invalid]="!!err(personForm, 'email', 'Email')" />
                @if (err(personForm, 'email', 'Email'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>

              <label class="dc-field">
                <span>Phone number</span>
                <input type="tel" formControlName="phone" autocomplete="tel"
                       placeholder="+234 801 234 5678"
                       [attr.aria-invalid]="!!err(personForm, 'phone', 'Phone number')" />
                @if (err(personForm, 'phone', 'Phone number'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>

              <label class="dc-field">
                <span>What would you like to discuss? <small>Optional</small></span>
                <textarea formControlName="notes" rows="3" [attr.maxlength]="limits.notes.max"></textarea>
                @if (err(personForm, 'notes', 'Notes'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>
            </div>
          } @else {
            <div [formGroup]="businessForm">
              <label class="dc-field">
                <span>Business name</span>
                <input type="text" formControlName="businessName" autocomplete="organization"
                       [attr.maxlength]="limits.businessName.max"
                       [attr.aria-invalid]="!!err(businessForm, 'businessName', 'Business name')" />
                @if (err(businessForm, 'businessName', 'Business name'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>

              <label class="dc-field">
                <span>Business email</span>
                <input type="email" formControlName="businessEmail" autocomplete="email"
                       [attr.aria-invalid]="!!err(businessForm, 'businessEmail', 'Business email')" />
                @if (err(businessForm, 'businessEmail', 'Business email'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>

              <label class="dc-field">
                <span>What would you like to discuss? <small>Optional</small></span>
                <textarea formControlName="notes" rows="3" [attr.maxlength]="limits.notes.max"></textarea>
                @if (err(businessForm, 'notes', 'Notes'); as m) { <em class="dc-field-error">{{ m }}</em> }
              </label>
            </div>
          }
        </fieldset>

        <button class="dc-btn dc-btn--primary dc-btn--block" type="submit" [disabled]="booking.submitting()">
          {{ booking.submitting() ? 'Sending…' : 'Book the call' }}
        </button>
        @if (booking.error(); as e) { <p class="dc-alert dc-alert--error" role="alert">{{ e }}</p> }
      </form>
    } @else {
      <form [formGroup]="requestForm" (ngSubmit)="submitRequest()" novalidate>
        <label class="dc-field">
          <span>What do you need?</span>
          <input type="text" formControlName="requestName"
                 [attr.maxlength]="limits.requestName.max"
                 placeholder="e.g. Migrate billing to Stripe"
                 [attr.aria-invalid]="!!err(requestForm, 'requestName', 'Request name')" />
          @if (err(requestForm, 'requestName', 'Request name'); as m) { <em class="dc-field-error">{{ m }}</em> }
        </label>

        <label class="dc-field">
          <span>Brief description</span>
          <textarea formControlName="description" rows="6"
                    [attr.maxlength]="limits.description.max"
                    placeholder="A few sentences on what you're trying to achieve, and by when."
                    [attr.aria-invalid]="!!err(requestForm, 'description', 'Description')"></textarea>
          <small class="dc-count">{{ descriptionLength() }} / {{ limits.description.max }}</small>
          @if (err(requestForm, 'description', 'Description'); as m) { <em class="dc-field-error">{{ m }}</em> }
        </label>

        <label class="dc-field">
          <span>Email for our reply</span>
          <input type="email" formControlName="email" autocomplete="email"
                 [attr.aria-invalid]="!!err(requestForm, 'email', 'Email')" />
          @if (err(requestForm, 'email', 'Email'); as m) { <em class="dc-field-error">{{ m }}</em> }
        </label>

        <button class="dc-btn dc-btn--primary dc-btn--block" type="submit" [disabled]="booking.submitting()">
          {{ booking.submitting() ? 'Sending…' : 'Send request' }}
        </button>
        @if (booking.error(); as e) { <p class="dc-alert dc-alert--error" role="alert">{{ e }}</p> }
      </form>
    }
  `,
  styles: [`
    :host { display: block; }
    .bf-step { border: 0; padding: 0; margin: 0 0 36px; min-width: 0; }
    .bf-step legend {
      display: flex; align-items: center; gap: 10px;
      font-size: 18px; font-weight: bold; margin-bottom: 18px; padding: 0;
    }
    .bf-num {
      display: inline-grid; place-items: center; width: 26px; height: 26px;
      background: var(--dc-ink); color: var(--dc-paper); font-size: 13px;
    }
  `],
})
export class BookingFormComponent implements OnInit {
  /** Which flow to show. */
  readonly kind = input.required<BookingKind>();
  /** Emits the receipt after a successful submission. */
  readonly submitted = output<BookingReceipt>();

  protected readonly booking = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly limits = BOOKING_LIMITS;

  protected readonly clientType = signal<ClientType>('person');

  protected readonly personForm = this.booking.createPersonConsultationForm();
  protected readonly businessForm = this.booking.createBusinessConsultationForm();
  protected readonly requestForm = this.booking.createRequestForm();
  protected readonly slotControl = this.booking.createSlotControl();

  protected readonly slots = signal<AvailabilitySlot[]>([]);
  protected readonly slotMinutes = signal(30);
  protected readonly slotsState = signal<'loading' | 'ready' | 'error'>('loading');

  /** Live character count, tracking the description control's value. */
  protected readonly descriptionLength = toSignal(
    this.requestForm.controls.description.valueChanges.pipe(
      startWith(this.requestForm.controls.description.value),
      map((value) => (value ?? '').length)
    ),
    { initialValue: 0 }
  );

  ngOnInit(): void {
    this.booking.reset();
    if (this.kind() === 'consultation') {
      this.loadAvailability();
    }
  }

  protected loadAvailability(): void {
    this.slotsState.set('loading');
    this.booking
      .getAvailability()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (availability) => {
          this.slots.set(availability.slots);
          this.slotMinutes.set(availability.slotMinutes);
          this.slotsState.set('ready');
          this.dropSlotIfTaken();
        },
        error: () => this.slotsState.set('error'),
      });
  }

  protected setClientType(clientType: ClientType): void {
    this.clientType.set(clientType);
    this.booking.reset();
  }

  /** Error text for a control, or null when it shouldn't show yet. */
  protected err(form: FormGroup, control: string, label: string): string | null {
    return firstErrorMessage(form.get(control), label);
  }

  protected submitConsultation(): void {
    const isPerson = this.clientType() === 'person';
    const form: FormGroup = isPerson ? this.personForm : this.businessForm;

    if (form.invalid || this.slotControl.invalid) {
      this.booking.revealErrors(form);
      this.slotControl.markAsTouched();
      return;
    }

    const slot: SlotSelection = { start: this.slotControl.value, timezone: localTimezone() };
    const details = isPerson
      ? this.booking.toPersonConsultation(this.personForm, slot)
      : this.booking.toBusinessConsultation(this.businessForm, slot);

    this.send(this.booking.submitConsultation(details), () => {
      form.reset();
      this.slotControl.reset();
    });
  }

  protected submitRequest(): void {
    if (this.requestForm.invalid) {
      this.booking.revealErrors(this.requestForm);
      return;
    }
    this.send(
      this.booking.submitRequest(this.booking.toRequestDetails(this.requestForm)),
      () => this.requestForm.reset()
    );
  }

  private send(request: Observable<BookingReceipt>, onSuccess: () => void): void {
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (receipt) => {
        onSuccess();
        this.submitted.emit(receipt);
      },
      error: (error: unknown) => {
        // The message is already in booking.error(). A 409 on a consultation
        // means the slot was taken while the form was open — refresh the grid.
        if (error instanceof BookingError && error.status === 409 && this.kind() === 'consultation') {
          this.loadAvailability();
        }
      },
    });
  }

  /** Clears the chosen slot if fresh availability says it's gone. */
  private dropSlotIfTaken(): void {
    const chosen = this.slotControl.value;
    if (chosen && !this.slots().some((s) => s.start === chosen && s.available)) {
      this.slotControl.setValue('');
    }
  }
}
