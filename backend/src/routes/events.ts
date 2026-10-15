import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/errors.js";
import { pool, withTransaction } from "../lib/db.js";
import { handle, idParam } from "../lib/http.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const eventsRouter = Router();

// Seats left is never stored: it is total_seats minus the confirmed bookings, so it cannot drift.
const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.starts_at, e.venue, e.total_seats,
         (e.total_seats - (SELECT count(*) FROM bookings b
                            WHERE b.event_id = e.id AND b.status = 'confirmed'))::int AS seats_left,
         (e.starts_at <= now()) AS is_past
  FROM events e`;

function mapEvent(r: any) {
  return {
    id: Number(r.id),
    title: r.title,
    description: r.description,
    startsAt: r.starts_at.toISOString(),
    venue: r.venue,
    totalSeats: r.total_seats,
    seatsLeft: r.seats_left,
    isPast: r.is_past,
  };
}

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
});

const eventFields = {
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().min(1, "Description is required").max(5000),
  startsAt: z.string().datetime({ offset: true, message: "startsAt must be an ISO date-time" }),
  venue: z.string().trim().min(1, "Venue is required").max(200),
  totalSeats: z.number().int("Seats must be a whole number").min(1, "At least 1 seat").max(100000),
};
const createSchema = z.object(eventFields);
const updateSchema = z.object(eventFields).partial().refine((v) => Object.keys(v).length > 0, {
  message: "Provide at least one field to update",
});

// Public: browse and search, paginated in SQL.
eventsRouter.get(
  "/",
  handle(async (req, res) => {
    const { search, when, page, limit } = listQuery.parse(req.query);
    const where: string[] = [];
    const params: unknown[] = [];

    if (search) {
      // Escape LIKE wildcards so a search for "100%" matches literally.
      params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(`e.title ILIKE $${params.length}`);
    }
    if (when === "upcoming") where.push("e.starts_at > now()");
    if (when === "past") where.push("e.starts_at <= now()");
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = Number(
      (await pool.query(`SELECT count(*) FROM events e ${whereSql}`, params)).rows[0].count,
    );
    // Upcoming: soonest first. Past/all: most recent first.
    const order = when === "upcoming" ? "ASC" : "DESC";
    const { rows } = await pool.query(
      `${EVENT_SELECT} ${whereSql} ORDER BY e.starts_at ${order}, e.id ${order}
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    res.json({
      data: rows.map(mapEvent),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  }),
);

eventsRouter.get(
  "/:id",
  handle(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { rows } = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [id]);
    if (!rows[0]) throw new HttpError(404, "event_not_found", "Event not found");
    res.json({ event: mapEvent(rows[0]) });
  }),
);

// Admin: create
eventsRouter.post(
  "/",
  requireAuth,
  requireAdmin,
  handle(async (req, res) => {
    const input = createSchema.parse(req.body);
    if (new Date(input.startsAt) <= new Date()) {
      throw new HttpError(400, "event_in_past", "New events must start in the future");
    }
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, starts_at, venue, total_seats)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.title, input.description, input.startsAt, input.venue, input.totalSeats],
    );
    const created = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [rows[0].id]);
    res.status(201).json({ event: mapEvent(created.rows[0]) });
  }),
);

// Admin: edit. The event row is locked so a booking can't slip in between our seat check and the update.
eventsRouter.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  handle(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const input = updateSchema.parse(req.body);

    await withTransaction(async (db) => {
      const found = await db.query("SELECT starts_at FROM events WHERE id = $1 FOR UPDATE", [id]);
      if (!found.rows[0]) throw new HttpError(404, "event_not_found", "Event not found");

      // Only a *changed* date must be in the future, so typo fixes on past events still work.
      if (input.startsAt) {
        const changed = new Date(input.startsAt).getTime() !== found.rows[0].starts_at.getTime();
        if (changed && new Date(input.startsAt) <= new Date()) {
          throw new HttpError(400, "event_in_past", "An event cannot be moved to a past date");
        }
      }
      if (input.totalSeats !== undefined) {
        const booked = Number(
          (await db.query("SELECT count(*) FROM bookings WHERE event_id = $1 AND status = 'confirmed'", [id]))
            .rows[0].count,
        );
        if (input.totalSeats < booked) {
          throw new HttpError(
            409,
            "seats_below_booked",
            `${booked} seats are already booked; total seats cannot be lower than that`,
          );
        }
      }

      const columns: Record<string, string> = {
        title: "title",
        description: "description",
        startsAt: "starts_at",
        venue: "venue",
        totalSeats: "total_seats",
      };
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [key, column] of Object.entries(columns)) {
        const value = (input as Record<string, unknown>)[key];
        if (value !== undefined) {
          values.push(value);
          sets.push(`${column} = $${values.length}`);
        }
      }
      values.push(id);
      await db.query(`UPDATE events SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    });

    const { rows } = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [id]);
    res.json({ event: mapEvent(rows[0]) });
  }),
);

// Admin: delete. Refused while anyone holds a confirmed booking; otherwise the cancelled history goes with it.
eventsRouter.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  handle(async (req, res) => {
    const id = idParam.parse(req.params.id);
    await withTransaction(async (db) => {
      const found = await db.query("SELECT id FROM events WHERE id = $1 FOR UPDATE", [id]);
      if (!found.rows[0]) throw new HttpError(404, "event_not_found", "Event not found");
      const active = Number(
        (await db.query("SELECT count(*) FROM bookings WHERE event_id = $1 AND status = 'confirmed'", [id]))
          .rows[0].count,
      );
      if (active > 0) {
        throw new HttpError(
          409,
          "event_has_bookings",
          `This event has ${active} active booking(s). Ask attendees to cancel first, or edit the event instead.`,
        );
      }
      await db.query("DELETE FROM bookings WHERE event_id = $1", [id]);
      await db.query("DELETE FROM events WHERE id = $1", [id]);
    });
    res.status(204).end();
  }),
);

// Admin: attendee list
eventsRouter.get(
  "/:id/bookings",
  requireAuth,
  requireAdmin,
  handle(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const event = await pool.query("SELECT id FROM events WHERE id = $1", [id]);
    if (!event.rows[0]) throw new HttpError(404, "event_not_found", "Event not found");
    const { rows } = await pool.query(
      `SELECT b.id, b.status, b.created_at, b.cancelled_at, u.id AS user_id, u.name, u.email
       FROM bookings b JOIN users u ON u.id = b.user_id
       WHERE b.event_id = $1
       ORDER BY b.created_at ASC`,
      [id],
    );
    res.json({
      data: rows.map((r) => ({
        id: Number(r.id),
        status: r.status,
        bookedAt: r.created_at.toISOString(),
        cancelledAt: r.cancelled_at ? r.cancelled_at.toISOString() : null,
        user: { id: Number(r.user_id), name: r.name, email: r.email },
      })),
    });
  }),
);
