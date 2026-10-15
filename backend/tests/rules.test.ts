import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/lib/db.js";
import { api, auth, createAdmin, createEvent, createUser, insertPastEvent, resetDb } from "./helpers.js";

let adminToken: string;

beforeEach(async () => {
  await resetDb();
  adminToken = await createAdmin();
});

afterAll(async () => {
  await pool.end();
});

describe("booking rules", () => {
  it("rejects a second booking of the same event, but allows rebooking after cancelling", async () => {
    const user = await createUser();
    const event = await createEvent(adminToken);

    const first = await api().post(`/events/${event.id}/bookings`).set(auth(user.token));
    expect(first.status).toBe(201);

    const duplicate = await api().post(`/events/${event.id}/bookings`).set(auth(user.token));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("already_booked");

    await api().delete(`/bookings/${first.body.booking.id}`).set(auth(user.token)).expect(200);
    await api().post(`/events/${event.id}/bookings`).set(auth(user.token)).expect(201);
  });

  it("never overbooks, even when many users grab the last seat at once", async () => {
    const event = await createEvent(adminToken, 1);
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => createUser()));

    const results = await Promise.all(
      users.map((u) => api().post(`/events/${event.id}/bookings`).set(auth(u.token))),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const failures = results.filter((r) => r.status !== 201);
    expect(failures).toHaveLength(4);
    failures.forEach((r) => expect(r.body.error.code).toBe("event_full"));

    const after = await api().get(`/events/${event.id}`);
    expect(after.body.event.seatsLeft).toBe(0);
  });

  it("rejects booking and cancelling for past events", async () => {
    const user = await createUser();
    const pastId = await insertPastEvent();

    const book = await api().post(`/events/${pastId}/bookings`).set(auth(user.token));
    expect(book.status).toBe(409);
    expect(book.body.error.code).toBe("event_past");

    // A booking that was made before the event started can no longer be cancelled.
    const { rows } = await pool.query(
      "INSERT INTO bookings (user_id, event_id) VALUES ($1, $2) RETURNING id",
      [user.id, pastId],
    );
    const cancel = await api().delete(`/bookings/${rows[0].id}`).set(auth(user.token));
    expect(cancel.status).toBe(409);
    expect(cancel.body.error.code).toBe("event_past");
  });

  it("only lets users cancel their own bookings, and cancelling frees the seat", async () => {
    const owner = await createUser();
    const other = await createUser();
    const event = await createEvent(adminToken, 5);

    const booking = await api().post(`/events/${event.id}/bookings`).set(auth(owner.token));
    expect((await api().get(`/events/${event.id}`)).body.event.seatsLeft).toBe(4);

    const stolen = await api().delete(`/bookings/${booking.body.booking.id}`).set(auth(other.token));
    expect(stolen.status).toBe(404);
    expect((await api().get(`/events/${event.id}`)).body.event.seatsLeft).toBe(4);

    await api().delete(`/bookings/${booking.body.booking.id}`).set(auth(owner.token)).expect(200);
    expect((await api().get(`/events/${event.id}`)).body.event.seatsLeft).toBe(5);
  });
});

describe("admin rules", () => {
  it("blocks normal users and anonymous callers from admin routes", async () => {
    const user = await createUser();
    const event = await createEvent(adminToken);
    const body = { title: "X", description: "Y", startsAt: new Date(Date.now() + 86_400_000).toISOString(), venue: "Z", totalSeats: 5 };

    expect((await api().post("/events").send(body)).status).toBe(401);
    expect((await api().post("/events").set(auth(user.token)).send(body)).status).toBe(403);
    expect((await api().patch(`/events/${event.id}`).set(auth(user.token)).send({ title: "Hacked" })).status).toBe(403);
    expect((await api().delete(`/events/${event.id}`).set(auth(user.token))).status).toBe(403);
    expect((await api().get(`/events/${event.id}/bookings`).set(auth(user.token))).status).toBe(403);
  });

  it("does not let anyone register as an admin", async () => {
    const res = await api()
      .post("/auth/register")
      .send({ name: "Sneaky", email: "sneaky@test.dev", password: "Password123", role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
  });

  it("refuses to cut seats below the number already booked", async () => {
    const event = await createEvent(adminToken, 5);
    for (let i = 0; i < 3; i++) {
      const u = await createUser();
      await api().post(`/events/${event.id}/bookings`).set(auth(u.token)).expect(201);
    }

    const tooFew = await api().patch(`/events/${event.id}`).set(auth(adminToken)).send({ totalSeats: 2 });
    expect(tooFew.status).toBe(409);
    expect(tooFew.body.error.code).toBe("seats_below_booked");

    const ok = await api().patch(`/events/${event.id}`).set(auth(adminToken)).send({ totalSeats: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body.event.seatsLeft).toBe(0);
  });

  it("refuses to delete an event that still has active bookings", async () => {
    const user = await createUser();
    const event = await createEvent(adminToken);
    const booking = await api().post(`/events/${event.id}/bookings`).set(auth(user.token));

    const blocked = await api().delete(`/events/${event.id}`).set(auth(adminToken));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("event_has_bookings");

    await api().delete(`/bookings/${booking.body.booking.id}`).set(auth(user.token)).expect(200);
    await api().delete(`/events/${event.id}`).set(auth(adminToken)).expect(204);
    await api().get(`/events/${event.id}`).expect(404);
  });
});

describe("browsing", () => {
  it("paginates and searches on the server", async () => {
    for (let i = 1; i <= 12; i++) await createEvent(adminToken, 10, i % 4 === 0 ? `Jazz night ${i}` : `Workshop ${i}`);

    const page1 = await api().get("/events?limit=5&page=1");
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.pagination).toMatchObject({ page: 1, limit: 5, total: 12, totalPages: 3 });

    const page3 = await api().get("/events?limit=5&page=3");
    expect(page3.body.data).toHaveLength(2);

    const search = await api().get("/events?search=jazz");
    expect(search.body.pagination.total).toBe(3);
    search.body.data.forEach((e: { title: string }) => expect(e.title.toLowerCase()).toContain("jazz"));
  });

  it("hides past events from the default list", async () => {
    await insertPastEvent();
    await createEvent(adminToken);
    expect((await api().get("/events")).body.pagination.total).toBe(1);
    expect((await api().get("/events?when=past")).body.pagination.total).toBe(1);
  });
});
