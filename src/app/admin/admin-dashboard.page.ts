import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  BOOKING_STATUS_FLOW,
  BOOKING_STATUS_LABELS,
  BookingKind,
  BookingRecord,
  BookingStatus,
} from '../booking/models/booking.models';
import { formatDateTime, formatSlotLong, localTimezone } from '../booking/services/booking.time';
import { AdminAuthService } from './admin-auth.service';
import { AdminBookingsService } from './admin-bookings.service';

type KindFilter = 'all' | BookingKind;
type SortKey = 'newest' | 'callTime';

/** Statuses that still need someone to act. */
const OPEN: readonly BookingStatus[] = ['pending', 'confirmed', 'in-review', 'scheduled'];

@Component({
  selector: 'dc-admin-dashboard-page',
  standalone: true,
  template: `
    <div class="dc-page admin">
      <div class="dc-container">
        <header class="admin__head">
          <div>
            <span class="dc-eyebrow" style="color: var(--dc-muted)">Staff</span>
            <h1 class="dc-page-title">Bookings</h1>
          </div>
          <div class="admin__head-actions">
            <button type="button" class="dc-btn dc-btn--ghost dc-btn--small" (click)="load()" [disabled]="state() === 'loading'">
              Refresh
            </button>
            <button type="button" class="dc-btn dc-btn--dark dc-btn--small" (click)="auth.signOut()">Sign out</button>
          </div>
        </header>

        <div class="stats">
          <div class="stat"><b>{{ stats().pending }}</b><span>Awaiting reply</span></div>
          <div class="stat"><b>{{ stats().upcomingCalls }}</b><span>Upcoming calls</span></div>
          <div class="stat"><b>{{ stats().openRequests }}</b><span>Open requests</span></div>
          <div class="stat"><b>{{ stats().total }}</b><span>All bookings</span></div>
        </div>

        <div class="filters">
          <div class="dc-toggle filters__kind" role="group" aria-label="Type">
            @for (k of kindOptions; track k.value) {
              <button type="button" [class.is-active]="kind() === k.value"
                      [attr.aria-pressed]="kind() === k.value" (click)="kind.set(k.value)">{{ k.label }}</button>
            }
          </div>
          <label class="dc-field filters__field">
            <span class="dc-visually-hidden">Status</span>
            <select class="dc-input" (change)="status.set($any($event.target).value)">
              <option value="open" [selected]="status() === 'open'">Open</option>
              <option value="all" [selected]="status() === 'all'">Any status</option>
              @for (s of allStatuses; track s) { <option [value]="s" [selected]="status() === s">{{ labels[s] }}</option> }
            </select>
          </label>
          <label class="dc-field filters__field">
            <span class="dc-visually-hidden">Sort</span>
            <select class="dc-input" [value]="sort()" (change)="sort.set($any($event.target).value)">
              <option value="newest">Newest first</option>
              <option value="callTime">Call time</option>
            </select>
          </label>
          <label class="dc-field filters__search">
            <span class="dc-visually-hidden">Search</span>
            <input class="dc-input" type="search" placeholder="Search name, email or reference"
                   [value]="query()" (input)="query.set($any($event.target).value)" />
          </label>
        </div>

        @if (actionError(); as e) {
          <p class="dc-alert dc-alert--error" role="alert">
            {{ e }} <button type="button" class="dc-link-button" (click)="actionError.set(null)">Dismiss</button>
          </p>
        }

        @switch (state()) {
          @case ('loading') { <p class="empty" role="status">Loading bookings…</p> }
          @case ('error') {
            <p class="dc-alert dc-alert--error" role="alert">
              Couldn't load bookings. <button type="button" class="dc-link-button" (click)="load()">Try again</button>
            </p>
          }
          @default {
            @if (visible().length === 0) {
              <p class="empty">No bookings match these filters.</p>
            } @else {
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Reference</th>
                      <th scope="col">Client / request</th>
                      <th scope="col">Type</th>
                      <th scope="col">When</th>
                      <th scope="col">Status</th>
                      <th scope="col"><span class="dc-visually-hidden">Details</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of visible(); track r.reference) {
                      <tr [class.is-open]="expanded() === r.reference">
                        <td class="mono">{{ r.reference }}</td>
                        <td>
                          <b>{{ r.displayName }}</b>
                          <small>{{ r.replyTo }}</small>
                        </td>
                        <td>{{ typeLabel(r) }}</td>
                        <td>
                          @if (r.kind === 'consultation') {
                            {{ callTime(r.details.slot.start) }}
                          } @else {
                            <small>Sent {{ date(r.submittedAt) }}</small>
                          }
                        </td>
                        <td>
                          <label class="status-cell">
                            <span class="dc-visually-hidden">Status for {{ r.reference }}</span>
                            <span class="dc-badge dc-badge--{{ r.status }}">{{ labels[r.status] }}</span>
                            <select [disabled]="saving().has(r.reference)"
                                    (change)="changeStatus(r, $any($event.target).value)">
                              @for (s of statusOptions(r); track s) {
                                <option [value]="s" [selected]="s === r.status">{{ labels[s] }}</option>
                              }
                            </select>
                          </label>
                        </td>
                        <td>
                          <button type="button" class="dc-link-button"
                                  [attr.aria-expanded]="expanded() === r.reference"
                                  (click)="toggle(r.reference)">
                            {{ expanded() === r.reference ? 'Hide' : 'View' }}
                          </button>
                        </td>
                      </tr>
                      @if (expanded() === r.reference) {
                        <tr class="detail">
                          <td colspan="6">
                            <dl>
                              @for (row of detailRows(r); track row.label) {
                                <div [class.wide]="row.wide"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
                              }
                            </dl>
                            <a class="dc-btn dc-btn--ghost dc-btn--small" [href]="'mailto:' + r.replyTo + '?subject=' + mailSubject(r)">
                              Email {{ r.replyTo }}
                            </a>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
              <p class="tz-note">Times shown in {{ timezone }}.</p>
            }
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .admin { background: var(--dc-tint); }
    .admin__head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .admin__head .dc-page-title { margin-bottom: 0; }
    .admin__head-actions { display: flex; gap: 8px; }

    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--dc-line-light); border: 1px solid var(--dc-line-light); margin-bottom: 24px; }
    .stat { background: var(--dc-paper); padding: 18px 20px; display: flex; flex-direction: column; }
    .stat b { font-size: 30px; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .stat span { font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--dc-muted); margin-top: 4px; }

    .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch; margin-bottom: 16px; }
    .filters .dc-field { margin: 0; }
    .filters__kind { margin: 0; }
    .filters__kind button { padding: 10px 16px; }
    .filters__field select { height: 100%; min-width: 150px; }
    .filters__search { flex: 1; min-width: 220px; }
    .filters__search input { height: 100%; }

    .table-wrap { overflow-x: auto; background: var(--dc-paper); border: 1px solid var(--dc-line-light); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 760px; }
    th { text-align: left; font-weight: normal; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--dc-muted); padding: 12px 14px; border-bottom: 1px solid var(--dc-line-light); }
    td { padding: 14px; border-bottom: 1px solid var(--dc-line-light); vertical-align: top; }
    td b { display: block; }
    td small { color: var(--dc-muted); font-size: 12.5px; }
    tr.is-open td { background: #FAFBFD; border-bottom-color: transparent; }
    .mono { font-family: var(--dc-font-ui); font-variant-numeric: tabular-nums; font-size: 13px; white-space: nowrap; }

    .status-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .status-cell select { font: inherit; font-size: 12.5px; padding: 4px 6px; border: 1px solid var(--dc-line-light); background: var(--dc-paper); }

    .detail td { background: #FAFBFD; padding-top: 0; }
    .detail dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 24px; margin: 0 0 16px; }
    .detail .wide { grid-column: 1 / -1; }
    .detail dt { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--dc-muted); }
    .detail dd { margin: 3px 0 0; white-space: pre-wrap; }

    .empty { padding: 40px; text-align: center; color: var(--dc-muted); background: var(--dc-paper); border: 1px solid var(--dc-line-light); }
    .tz-note { font-size: 12px; color: var(--dc-muted); margin-top: 10px; }

    @media (max-width: 760px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .detail dl { grid-template-columns: 1fr; }
    }
  `],
})
export class AdminDashboardPage implements OnInit {
  protected readonly auth = inject(AdminAuthService);
  private readonly api = inject(AdminBookingsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly labels = BOOKING_STATUS_LABELS;
  protected readonly allStatuses = Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[];
  protected readonly kindOptions: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'consultation', label: 'Calls' },
    { value: 'request', label: 'Requests' },
  ];
  protected readonly timezone = localTimezone();

  protected readonly records = signal<BookingRecord[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly saving = signal<ReadonlySet<string>>(new Set());
  protected readonly actionError = signal<string | null>(null);
  protected readonly expanded = signal<string | null>(null);

  protected readonly kind = signal<KindFilter>('all');
  protected readonly status = signal<'open' | 'all' | BookingStatus>('open');
  protected readonly sort = signal<SortKey>('newest');
  protected readonly query = signal('');

  protected readonly stats = computed(() => {
    const all = this.records();
    const now = Date.now();
    return {
      total: all.length,
      pending: all.filter((r) => r.status === 'pending').length,
      upcomingCalls: all.filter(
        (r) => r.kind === 'consultation' && OPEN.includes(r.status) && Date.parse(r.details.slot.start) > now
      ).length,
      openRequests: all.filter((r) => r.kind === 'request' && OPEN.includes(r.status)).length,
    };
  });

  protected readonly visible = computed(() => {
    const kind = this.kind();
    const status = this.status();
    const q = this.query().trim().toLowerCase();

    const rows = this.records().filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (status === 'open' && !OPEN.includes(r.status)) return false;
      if (status !== 'open' && status !== 'all' && r.status !== status) return false;
      if (q) {
        const haystack = `${r.reference} ${r.displayName} ${r.replyTo}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (this.sort() === 'callTime') {
      // Calls in slot order first, then requests newest first.
      const key = (r: BookingRecord) => (r.kind === 'consultation' ? Date.parse(r.details.slot.start) : Infinity);
      return rows.sort((a, b) => key(a) - key(b) || b.submittedAt.localeCompare(a.submittedAt));
    }
    return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.records.set(records);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  protected statusOptions(r: BookingRecord): BookingStatus[] {
    return [...BOOKING_STATUS_FLOW[r.kind], 'cancelled'];
  }

  /** Optimistic update — rolls back if the API refuses. */
  protected changeStatus(record: BookingRecord, status: BookingStatus): void {
    if (status === record.status) return;
    const previous = record.status;
    const ref = record.reference;

    this.actionError.set(null);
    this.patchLocal(ref, { status });
    this.saving.update((s) => new Set(s).add(ref));

    this.api
      .updateStatus(ref, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.records.update((all) => all.map((r) => (r.reference === ref ? updated : r)));
          this.doneSaving(ref);
        },
        error: () => {
          this.patchLocal(ref, { status: previous });
          this.doneSaving(ref);
          this.actionError.set(`Couldn't update ${ref}. The status has been put back.`);
        },
      });
  }

  protected toggle(reference: string): void {
    this.expanded.update((current) => (current === reference ? null : reference));
  }

  protected typeLabel(r: BookingRecord): string {
    if (r.kind === 'request') return 'Request';
    return r.details.clientType === 'person' ? 'Call · individual' : 'Call · business';
  }

  protected detailRows(r: BookingRecord): { label: string; value: string; wide?: boolean }[] {
    const rows: { label: string; value: string; wide?: boolean }[] = [];
    if (r.kind === 'consultation') {
      const d = r.details;
      rows.push({ label: 'Call time (client)', value: formatSlotLong(d.slot.start, d.slot.timezone) });
      if (d.clientType === 'person') {
        rows.push({ label: 'Email', value: d.email }, { label: 'Phone', value: d.phone });
      } else {
        rows.push({ label: 'Business email', value: d.businessEmail });
      }
      if (d.notes) rows.push({ label: 'Notes', value: d.notes, wide: true });
    } else {
      rows.push(
        { label: 'Request', value: r.details.requestName },
        { label: 'Email', value: r.details.email },
        { label: 'Description', value: r.details.description, wide: true }
      );
    }
    rows.push(
      { label: 'Submitted', value: formatDateTime(r.submittedAt) },
      { label: 'Last update', value: formatDateTime(r.updatedAt) }
    );
    return rows;
  }

  protected mailSubject(r: BookingRecord): string {
    return encodeURIComponent(`Your Diadem Consults booking ${r.reference}`);
  }

  protected callTime(iso: string): string {
    return formatDateTime(iso, this.timezone);
  }

  protected date(iso: string): string {
    return formatDateTime(iso, this.timezone);
  }

  private patchLocal(reference: string, patch: Partial<Pick<BookingRecord, 'status'>>): void {
    this.records.update((all) =>
      all.map((r) => (r.reference === reference ? ({ ...r, ...patch } as BookingRecord) : r))
    );
  }

  private doneSaving(reference: string): void {
    this.saving.update((s) => {
      const next = new Set(s);
      next.delete(reference);
      return next;
    });
  }
}
