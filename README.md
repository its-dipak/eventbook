# EventBook

A small event booking app. An admin publishes events with a fixed number of seats, visitors can browse without logging in, and registered users can book a seat and cancel later. Seats are never overbooked.

- **Live app:** `<YOUR VERCEL URL>`
- **API:** `<YOUR RENDER URL>` (health check: `/health`)
- **Repository layout:** `backend/` (Express API) and `frontend/` (Next.js UI). They are fully separate: the frontend never talks to the database, and Next.js has no API routes or server actions.

> Free-tier note: the API sleeps after inactivity on Render's free plan, so the **first request can take about 30–60 seconds**. If the event list looks stuck at first load, wait a moment and it will appear.

## Test accounts

| Role  | Email                  | Password     |
| ----- | ---------------------- | ------------ |
| Admin | `admin@eventbook.test` | `Admin@12345` |
| User  | `user@eventbook.test`  | `User@12345`  |

The seed data also includes a past event, an event with 1 seat left, a sold-out event, and enough events to try search and pagination.

## Tech stack

- **Frontend:** Next.js 15 (App Router) + TypeScript, plain CSS
- **Backend:** Node.js + Express + TypeScript, `zod` for validation, `bcryptjs` + JWT for auth
- **Database:** Supabase (PostgreSQL), accessed from the API with `pg` and plain SQL
- **Tests:** Vitest + Supertest against a real Postgres database

## Run it locally

You need Node 20+ and a Postgres database (a free Supabase project works).

```bash
# 1. Backend
cd backend
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run migrate             # creates the tables
npm run seed                # admin, user and sample events
npm run dev                 # http://localhost:4000

# 2. Frontend (in a second terminal)
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:3000
```

### Environment variables

| Where    | Variable                | Purpose                                                      |
| -------- | ----------------------- | ------------------------------------------------------------ |
| backend  | `DATABASE_URL`          | Supabase Postgres connection string (use the Session pooler) |
| backend  | `JWT_SECRET`            | Secret used to sign login tokens                             |
| backend  | `CORS_ORIGIN`           | Frontend URL allowed to call the API                         |
| backend  | `TEST_DATABASE_URL`     | Throwaway database for `npm test` (its tables get emptied)   |
| frontend | `NEXT_PUBLIC_API_URL`   | Base URL of the API                                          |

### Tests

```bash
cd backend
TEST_DATABASE_URL=postgresql://... npm test
```

The tests cover: double booking, overbooking when many users book the last seat at the same time, booking and cancelling past events, cancelling someone else's booking, admin-only routes, reducing seats below the booked count, deleting an event that has bookings, and pagination/search.

## Design decisions

**Data model.** Three tables: `users`, `events`, `bookings`. A cancelled booking is kept with `status = 'cancelled'` instead of being deleted, so there is a history and a user can book the same event again later.

**No double booking, enforced by the database.** A partial unique index on `bookings (user_id, event_id) WHERE status = 'confirmed'` guarantees one active booking per user per event, even if two requests arrive at the same moment. The API also checks first so it can return a friendly message.

**No overbooking, even under concurrency.** Booking runs in a single transaction that first locks the event row (`SELECT ... FOR UPDATE`), then checks the date, the existing booking and the seat count, then inserts. Two people booking the last seat are processed one after the other, so one succeeds and the other gets "this event is full". This is covered by a test that fires five simultaneous requests for one seat.

**Seats left is calculated, not stored.** `seatsLeft = total_seats - confirmed bookings`, computed in the query. There is no counter that could drift out of sync after a cancellation or a crash.

**Admin edits use the same lock.** Lowering `total_seats` takes the event row lock and refuses to go below the number of confirmed bookings.

**Deleting an event with bookings is refused (409).** The admin must edit the event instead, or wait until attendees cancel. This avoids silently destroying people's bookings. Events with only cancelled bookings can be deleted.

**Authentication.** Passwords are hashed with bcrypt. Login returns a JWT (7 days) that the frontend sends in the `Authorization` header. Registration always creates a normal user; the only way to get an admin is the seed script. Login is rate limited, and the "wrong email" and "wrong password" messages are identical.

**Authorization.** Every protected route is checked on the API (`requireAuth`, `requireAdmin`). The frontend hides admin links and pages for friendliness, but that is not the security boundary. Asking for someone else's booking returns 404 so booking ids cannot be probed.

**Errors.** Every error has the same shape, `{ "error": { "code", "message" } }`, and validation errors add per-field details. Server errors never leak stack traces.

**Pagination and search happen in SQL** (`LIMIT/OFFSET`, `ILIKE`), with `%` and `_` in the search text escaped.

## API overview

| Method & path                | Access     | Purpose                                  |
| ---------------------------- | ---------- | ---------------------------------------- |
| `POST /auth/register`        | public     | Create a normal user account             |
| `POST /auth/login`           | public     | Log in, receive a token                  |
| `GET /auth/me`               | user       | Current user                             |
| `GET /events`                | public     | List events (`search`, `when`, `page`, `limit`) |
| `GET /events/:id`            | public     | One event with seats left                |
| `POST /events/:id/bookings`  | user       | Book a seat                              |
| `GET /me/bookings`           | user       | My bookings                              |
| `DELETE /bookings/:id`       | owner      | Cancel my booking                        |
| `POST /events`               | admin      | Create an event                          |
| `PATCH /events/:id`          | admin      | Edit an event                            |
| `DELETE /events/:id`         | admin      | Delete an event (no active bookings)     |
| `GET /events/:id/bookings`   | admin      | Attendee list                            |

## Trade-offs and what I would do next

- **Token in `localStorage`.** It is simple when the frontend and API are on different domains, but page scripts can read it if there is ever an XSS bug. A production app would use an `HttpOnly` cookie, which needs same-site hosting or careful CORS and CSRF handling.
- **Admin search and tabs are basic.** A real admin area would add sorting and filters.
- **No email confirmations or waitlist.** Out of scope for the time budget.
- **Time zones.** Dates are stored in UTC and shown in each visitor's own time zone.

## Deployment

- **Database:** Supabase project (run `npm run migrate` and `npm run seed` once against it).
- **API:** Render web service, root directory `backend`, build `npm install --include=dev && npm run build`, start `npm start`.
- **Frontend:** Vercel project, root directory `frontend`, with `NEXT_PUBLIC_API_URL` pointing at the API.

## How AI was used

<!-- Write this section in your own words. Be honest about which tools you used and which parts you wrote or changed yourself. -->
