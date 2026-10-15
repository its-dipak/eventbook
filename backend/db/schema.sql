CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  venue       TEXT NOT NULL,
  total_seats INTEGER NOT NULL CHECK (total_seats > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);

-- Cancelled bookings stay as history (status = 'cancelled') so a user can rebook later.
CREATE TABLE IF NOT EXISTS bookings (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users (id),
  event_id     BIGINT NOT NULL REFERENCES events (id),
  status       TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

-- Rule 1 enforced by the database: one active booking per user per event.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_user_event
  ON bookings (user_id, event_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_event_idx ON bookings (event_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id);
