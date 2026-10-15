import { Router } from "express";
import { HttpError } from "../lib/errors.js";
import { pool, withTransaction } from "../lib/db.js";
import { handle, idParam } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";

export const bookingsRouter = Router();

// Book one seat. Locking the event row serializes concurrent bookings for the same event,
// so two people grabbing the last seat cannot both pass the capacity check.
bookingsRouter.post(
  "/events/:id/bookings",
  requireAuth,
  handle(async (req, res) => {
    const eventId = idParam.parse(req.params.id);
    const userId = req.auth!.id;

    try {
      const booking = await withTransaction(async (db) => {
        const found = await db.query(
          "SELECT total_seats, (starts_at <= now()) AS is_past FROM events WHERE id = $1 FOR UPDATE",
          [eventId],
        );
        const event = found.rows[0];
        if (!event) throw new HttpError(404, "event_not_found", "Event not found");
        if (event.is_past) throw new HttpError(409, "event_past", "This event has already started or finished");

        const existing = await db.query(
          "SELECT 1 FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'",
          [eventId, userId],
        );
        if (existing.rows[0]) throw new HttpError(409, "already_booked", "You have already booked this event");

        const taken = Number(
          (await db.query("SELECT count(*) FROM bookings WHERE event_id = $1 AND status = 'confirmed'", [eventId]))
            .rows[0].count,
        );
        if (taken >= event.total_seats) throw new HttpError(409, "event_full", "Sorry, this event is full");

        const inserted = await db.query(
          "INSERT INTO bookings (user_id, event_id) VALUES ($1, $2) RETURNING id, status, created_at",
          [userId, eventId],
        );
        return inserted.rows[0];
      });
      res.status(201).json({
        booking: { id: Number(booking.id), eventId, status: booking.status, createdAt: booking.created_at.toISOString() },
      });
    } catch (err: any) {
      // Backstop: the partial unique index rejects a duplicate even if the check above were bypassed.
      if (err.code === "23505") throw new HttpError(409, "already_booked", "You have already booked this event");
      throw err;
    }
  }),
);

bookingsRouter.get(
  "/me/bookings",
  requireAuth,
  handle(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.id, b.status, b.created_at, b.cancelled_at,
              e.id AS event_id, e.title, e.starts_at, e.venue, (e.starts_at <= now()) AS is_past
       FROM bookings b JOIN events e ON e.id = b.event_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.auth!.id],
    );
    res.json({
      data: rows.map((r) => ({
        id: Number(r.id),
        status: r.status,
        bookedAt: r.created_at.toISOString(),
        cancelledAt: r.cancelled_at ? r.cancelled_at.toISOString() : null,
        event: {
          id: Number(r.event_id),
          title: r.title,
          startsAt: r.starts_at.toISOString(),
          venue: r.venue,
          isPast: r.is_past,
        },
      })),
    });
  }),
);

// Cancel. Seats left is derived from confirmed bookings, so flipping the status frees the seat.
// Someone else's booking answers 404 (same as a missing one) so booking ids can't be probed.
bookingsRouter.delete(
  "/bookings/:id",
  requireAuth,
  handle(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const userId = req.auth!.id;

    const booking = await withTransaction(async (db) => {
      const found = await db.query(
        `SELECT b.status, b.user_id, (e.starts_at <= now()) AS is_past
         FROM bookings b JOIN events e ON e.id = b.event_id
         WHERE b.id = $1 FOR UPDATE OF b`,
        [id],
      );
      const row = found.rows[0];
      if (!row || Number(row.user_id) !== userId) {
        throw new HttpError(404, "booking_not_found", "Booking not found");
      }
      if (row.status === "cancelled") throw new HttpError(409, "already_cancelled", "This booking is already cancelled");
      if (row.is_past) throw new HttpError(409, "event_past", "Bookings for past events cannot be cancelled");

      const updated = await db.query(
        "UPDATE bookings SET status = 'cancelled', cancelled_at = now() WHERE id = $1 RETURNING id, event_id, status, cancelled_at",
        [id],
      );
      return updated.rows[0];
    });
    res.json({
      booking: {
        id: Number(booking.id),
        eventId: Number(booking.event_id),
        status: booking.status,
        cancelledAt: booking.cancelled_at.toISOString(),
      },
    });
  }),
);
