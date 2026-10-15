import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/lib/db.js";

export const api = () => request(app);

/** Empties every table and re-applies the schema. */
export async function resetDb() {
  await pool.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  await pool.query("TRUNCATE bookings, events, users RESTART IDENTITY CASCADE");
}

export async function createAdmin() {
  const hash = await bcrypt.hash("Admin@12345", 4);
  await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@test.dev', $1, 'admin')", [hash]);
  const res = await api().post("/auth/login").send({ email: "admin@test.dev", password: "Admin@12345" });
  return res.body.token as string;
}

let counter = 0;
/** Registers a fresh normal user through the real API and returns their token. */
export async function createUser() {
  counter += 1;
  const res = await api()
    .post("/auth/register")
    .send({ name: `User ${counter}`, email: `user${counter}@test.dev`, password: "Password123" });
  return { token: res.body.token as string, id: res.body.user.id as number };
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** Creates an upcoming event through the admin API. */
export async function createEvent(adminToken: string, totalSeats = 10, title = "Test Event") {
  const res = await api()
    .post("/events")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ title, description: "A test event", startsAt: days(5), venue: "Test Hall", totalSeats });
  return res.body.event as { id: number; seatsLeft: number };
}

/** Inserts an event that already started (the API refuses to create these). */
export async function insertPastEvent() {
  const { rows } = await pool.query(
    "INSERT INTO events (title, description, starts_at, venue, total_seats) VALUES ('Old', 'Past', now() - interval '2 days', 'Hall', 10) RETURNING id",
  );
  return Number(rows[0].id);
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
