# Diadem Consults — Booking Service

The Angular app where people and businesses book time with Diadem Consults:

1. **Consultation call.** An individual or a business picks a 30-minute slot and leaves contact details.
2. **Technology request.** A short name, a brief description and a reply email.

Clients get a reference (e.g. `DC-8F2K1A`) and can check progress with it. Staff
manage everything from a dashboard at `/admin`.

Angular 22 (zoneless), standalone components, signals, strict mode. Needs Node 22.22+, 24.15+ or 26.

## Run it

```bash
npm install
npm start          # http://localhost:4200
npm test           # Vitest + jsdom, no browser needed
npm run build      # dist/dc-booking-service
```

Each of these first runs `npm run sync-brand`, which copies assets from
`../diadem-consults-brand` into `public/`.

No backend is needed yet. `environment.useMockApi` is `true`, so an in-browser
mock answers every `/api` call and keeps bookings in `localStorage`. The
dashboard passcode for the mock is `diadem-admin`. To start again from the
sample data, clear the site's storage.

## Pages

| Route | What it does |
|---|---|
| `/` | Landing page with both ways to book and how the process works |
| `/book/consultation` | Pick a slot, then person or business details |
| `/book/request` | Technology request form |
| `/book/confirmed` | Reference, call time and an `.ics` "Add to calendar" download |
| `/status?ref=` | Look up a booking by reference + email |
| `/admin/login` | Staff sign-in |
| `/admin` | Dashboard with stats, filters, search, details and status changes (guarded) |

## Layout

```
src/app/
  booking/                        the booking feature, self-contained
    models/booking.models.ts      domain types, status labels/flows, guards
    services/booking.service.ts   forms, normalisation, API calls, state
    services/booking.validators.ts
    services/booking.time.ts      timezone-aware formatting, slot grouping, .ics
    slot-picker.component.ts      day tabs + time grid (a form control)
    booking-form.component.ts     both flows; emits the receipt on success
    booking.config.ts             BOOKING_API_BASE token (default /api)
  admin/                          auth service, guard, interceptor, pages
  core/mock-api/                  mock backend: interceptor, store, schedule
  layout/                         header, footer, Crown Grid logo
  pages/                          home, book, confirmation, status, 404
```

## Brand

Styles follow `../diadem-consults-brand`:

- Palette and type tokens are mirrored in `src/styles.css`.
- Signal Blue appears on one element per view, the primary action.
- Corners are square throughout.

Angular only serves assets from inside the workspace. `scripts/sync-brand.mjs`
copies the icons, `site.webmanifest`, `social/` and `logo/` from the brand
folder into `public/`, where the copies are gitignored. The brand pack stays
the single source of truth. Keep the two folders side by side. If the brand
folder is missing, the script leaves `public/` as it is.

## Scheduling

The mock offers weekday slots from 09:00 to 17:00 **Africa/Lagos**. Each slot is
30 minutes, runs up to 14 days ahead and needs at least 2 hours' notice. These
settings live in `core/mock-api/mock-schedule.ts`.

Slots travel as ISO instants. The picker groups and labels them in the
*viewer's* timezone, and the booking stores the client's zone next to the slot,
so replies can use the client's local time.

If someone takes a slot while the form is open, the API returns `409`. The
form then shows the message, reloads availability and clears the stale
choice.

## Wire format

`POST /api/bookings`. The envelope is flat, with `kind` at the top level:

```json
{
  "kind": "consultation",
  "submittedAt": "2026-09-28T09:15:00.000Z",
  "clientType": "person",
  "name": "Chinedu O",
  "email": "chinedu@diadem-consults.com",
  "phone": "+2348012345678",
  "slot": { "start": "2026-10-02T08:30:00.000Z", "timezone": "Europe/London" },
  "displayName": "Chinedu O",
  "replyTo": "chinedu@diadem-consults.com"
}
```

```json
{
  "kind": "request",
  "submittedAt": "2026-09-28T09:15:00.000Z",
  "requestName": "Migrate billing to Stripe",
  "description": "…",
  "email": "cto@acme.io",
  "displayName": "Migrate billing to Stripe",
  "replyTo": "cto@acme.io"
}
```

Response (`201`):

```json
{
  "reference": "DC-8F2K1A",
  "kind": "consultation",
  "status": "pending",
  "submittedAt": "2026-09-28T09:15:00.000Z",
  "message": "Received. We'll confirm your call by email within one business day.",
  "slot": { "start": "2026-10-02T08:30:00.000Z", "timezone": "Europe/London" }
}
```

## API a real backend must provide

| Method | Path | Notes |
|---|---|---|
| `GET` | `/availability` | `{ timezone, slotMinutes, slots: [{ start, available }] }` |
| `POST` | `/bookings` | `201` receipt, `422 { message }` on bad input, `409 { message }` if the slot is taken |
| `GET` | `/bookings/status?reference=&email=` | `404` for both "no such reference" and "wrong email" |
| `POST` | `/admin/session` | `{ passcode }` → `{ token }` |
| `GET` | `/admin/bookings` | Bearer token; full records |
| `PATCH` | `/admin/bookings/:reference` | `{ status }` → updated record |

Status flows: consultations go `pending → confirmed → completed`; requests go
`pending → in-review → scheduled → completed`. Either can be `cancelled` at any
point.

To point at a real server, set `useMockApi: false`. If the API isn't at `/api`,
also provide `BOOKING_API_BASE` in `app.config.ts`.

**The admin sign-in is a placeholder.** A shared passcode is fine for a demo but
not for production. Replace it with real staff accounts on the backend. The
front end only needs a token back.

## Behaviour worth knowing

- **Discriminated unions.** `ConsultationDetails` is a union on `clientType`,
  and `BookingRecord` is a union on `kind`, so templates and code narrow safely.
- **Stricter email than Angular's.** `strictEmail()` requires a dotted TLD.
- **Phone normalisation.** `+234 801-234 5678` is stored as `+2348012345678`.
- **Whitespace can't satisfy `required`.** `notBlank()` and `trimmedLength()`
  measure the trimmed value.
- **Retries are selective.** 5xx and network failures retry twice with
  backoff; 4xx errors don't retry.
- **Error copy lives in one place.** `firstErrorMessage(control, label)` holds it.
