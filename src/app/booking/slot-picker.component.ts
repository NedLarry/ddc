import {
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { AvailabilitySlot } from './models/booking.models';
import { SlotDay, formatTime, groupSlotsByDay, localTimezone } from './services/booking.time';

/**
 * Day tabs + time grid for choosing a consultation slot.
 *
 * Works as a form control — its value is the chosen slot's ISO start, or ''
 * — so it plugs into `[formControl]` like any input. Times are shown in the
 * viewer's own zone.
 */
@Component({
  selector: 'dc-slot-picker',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SlotPickerComponent),
      multi: true,
    },
  ],
  template: `
    @switch (state()) {
      @case ('loading') {
        <p class="sp-note" role="status">Loading available times…</p>
      }
      @case ('error') {
        <p class="dc-alert dc-alert--error" role="alert">
          We couldn't load available times.
          <button type="button" class="dc-link-button" (click)="retry.emit()">Try again</button>
        </p>
      }
      @default {
        @if (days().length === 0) {
          <p class="sp-note">There are no open slots in the next two weeks. Send a request instead and we'll find a time.</p>
        } @else {
          <div class="sp-days" role="tablist" aria-label="Day">
            @for (day of days(); track day.key) {
              <button
                type="button"
                role="tab"
                class="sp-day"
                [class.is-active]="day.key === activeDay()?.key"
                [class.is-full]="!day.hasOpenSlots"
                [attr.aria-selected]="day.key === activeDay()?.key"
                [disabled]="disabled()"
                (click)="selectDay(day)">
                <span class="sp-day__wd">{{ day.weekday }}</span>
                <span class="sp-day__date">{{ day.date }}</span>
              </button>
            }
          </div>

          @if (activeDay(); as day) {
            <div class="sp-times" role="radiogroup" [attr.aria-label]="'Times on ' + day.weekday + ' ' + day.date">
              @for (slot of day.slots; track slot.start) {
                <button
                  type="button"
                  role="radio"
                  class="sp-time"
                  [class.is-active]="slot.start === value()"
                  [attr.aria-checked]="slot.start === value()"
                  [disabled]="disabled() || !slot.available"
                  [attr.title]="slot.available ? null : 'Already booked'"
                  (click)="choose(slot)">
                  {{ label(slot) }}
                </button>
              }
            </div>
          }

          <p class="sp-note">
            {{ slotMinutes() }}-minute call. Times shown in <strong>{{ timezone }}</strong>.
          </p>
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .sp-days {
      display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px;
      scrollbar-width: thin;
    }
    .sp-day {
      flex: 0 0 auto; min-width: 72px; padding: 10px 12px;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      background: var(--dc-paper); border: 1px solid var(--dc-line-light);
      font: inherit; color: var(--dc-ink); cursor: pointer;
    }
    .sp-day__wd { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--dc-muted); }
    .sp-day__date { font-size: 14px; font-weight: bold; }
    .sp-day.is-full { opacity: .5; }
    .sp-day.is-active { background: var(--dc-ink); border-color: var(--dc-ink); color: var(--dc-paper); }
    .sp-day.is-active .sp-day__wd { color: var(--dc-mist); }

    .sp-times { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
    .sp-time {
      padding: 10px 8px; background: var(--dc-paper); border: 1px solid var(--dc-line-light);
      font: inherit; font-size: 14px; color: var(--dc-ink); cursor: pointer;
    }
    .sp-time:hover:not(:disabled) { border-color: var(--dc-navy); }
    .sp-time:disabled { color: #A9B3C5; text-decoration: line-through; cursor: not-allowed; background: var(--dc-tint); }
    .sp-time.is-active { background: var(--dc-navy); border-color: var(--dc-navy); color: var(--dc-paper); }

    .sp-note { font-size: 13px; color: var(--dc-muted); margin: 14px 0 0; }
  `],
})
export class SlotPickerComponent implements ControlValueAccessor {
  /** Slots from the availability API. */
  readonly slots = input<readonly AvailabilitySlot[]>([]);
  readonly slotMinutes = input(30);
  readonly state = input<'loading' | 'ready' | 'error'>('loading');
  /** Emitted when the viewer asks to reload after an error. */
  readonly retry = output<void>();

  protected readonly timezone = localTimezone();
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  protected readonly days = computed(() => groupSlotsByDay(this.slots(), this.timezone));

  private readonly chosenDayKey = signal<string | null>(null);

  /**
   * The open tab: whichever the viewer clicked, else the day holding the
   * current value, else the first day with anything free.
   */
  protected readonly activeDay = computed<SlotDay | undefined>(() => {
    const days = this.days();
    const byKey = (key: string | null) => days.find((d) => d.key === key);
    const value = this.value();
    const valueDay = value ? days.find((d) => d.slots.some((s) => s.start === value)) : undefined;
    return byKey(this.chosenDayKey()) ?? valueDay ?? days.find((d) => d.hasOpenSlots) ?? days[0];
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected label(slot: AvailabilitySlot): string {
    return formatTime(slot.start, this.timezone);
  }

  protected selectDay(day: SlotDay): void {
    this.chosenDayKey.set(day.key);
  }

  protected choose(slot: AvailabilitySlot): void {
    if (!slot.available || this.disabled()) return;
    this.value.set(slot.start);
    this.onChange(slot.start);
    this.onTouched();
  }

  /* ControlValueAccessor */

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
    if (!value) this.chosenDayKey.set(null);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
