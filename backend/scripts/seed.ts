import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../src/lib/db.js";

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@eventbook.test").toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
const userEmail = (process.env.SEED_USER_EMAIL ?? "user@eventbook.test").toLowerCase();
const userPassword = process.env.SEED_USER_PASSWORD ?? "User@12345";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString();

const venues = ["Kathmandu Tech Hub", "Pokhara Lakeside Hall", "Patan Durbar Square", "Bhaktapur Cultural Center"];

await withTransaction(async (db) => {
  // Users: safe to run repeatedly. The password is reset to the seed value each time.
  async function upsertUser(name: string, email: string, password: string, role: "user" | "admin") {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(email)) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
       RETURNING id`,
      [name, email, hash, role],
    );
    return Number(rows[0].id);
  }

  await upsertUser("Admin", adminEmail, adminPassword, "admin");
  const userId = await upsertUser("Test User", userEmail, userPassword, "user");
  const attendees = [
    await upsertUser("Attendee One", "attendee1@eventbook.test", userPassword, "user"),
    await upsertUser("Attendee Two", "attendee2@eventbook.test", userPassword, "user"),
  ];

  // Events: only seeded into an empty table, so re-running never duplicates them or touches real data.
  const existing = Number((await db.query("SELECT count(*) FROM events")).rows[0].count);
  if (existing > 0) {
    console.log("Events already exist; skipping sample events.");
    return;
  }

  async function addEvent(title: string, description: string, startsAt: string, seats: number, venue: string) {
    const { rows } = await db.query(
      "INSERT INTO events (title, description, starts_at, venue, total_seats) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [title, description, startsAt, venue, seats],
    );
    return Number(rows[0].id);
  }
  async function book(uid: number, eventId: number) {
    await db.query("INSERT INTO bookings (user_id, event_id) VALUES ($1, $2)", [uid, eventId]);
  }

  // Rule-testing events
  const past = await addEvent("Winter Code Meetup (past)", "A finished meetup, used to check that past events cannot be booked or cancelled.", inDays(-10), 50, venues[0]);
  await book(userId, past);
  const nearlyFull = await addEvent("Hands-on React Workshop (1 seat left)", "Only one seat remains. Book it, then try booking again.", inDays(7), 3, venues[1]);
  await book(attendees[0], nearlyFull);
  await book(attendees[1], nearlyFull);
  const full = await addEvent("Sold-out Jazz Night (full)", "Every seat is taken, so booking should fail with a clear message.", inDays(9), 2, venues[2]);
  await book(attendees[0], full);
  await book(attendees[1], full);

  // Enough ordinary events to exercise search and pagination (default page size is 9)
  const topics = [
    ["Intro to TypeScript Workshop", "Types, generics and tooling for JavaScript developers."],
    ["Startup Founders Meetup", "Casual evening to meet other founders and share lessons."],
    ["Open Source Contribution Day", "Pick an issue, send a pull request, get a review."],
    ["Acoustic Evening Concert", "Live acoustic sets from local artists."],
    ["Postgres Deep Dive", "Indexes, transactions and query plans, explained with demos."],
    ["Product Design Bootcamp", "A one-day crash course on user research and prototyping."],
    ["Himalayan Photography Walk", "Guided walk with tips on landscape photography."],
    ["Cloud Deployment Lab", "Deploy a small app to the cloud, start to finish."],
    ["Women in Tech Panel", "Panel discussion followed by networking."],
    ["Data Science Meetup", "Short talks on real-world data projects."],
    ["Board Game Night", "Bring a friend and try something new."],
    ["Career Fair for Interns", "Meet teams hiring interns and juniors."],
  ];
  for (let i = 0; i < topics.length; i++) {
    await addEvent(topics[i][0], topics[i][1], inDays(12 + i * 3), 20 + (i % 4) * 10, venues[i % venues.length]);
  }
  console.log(`Seeded ${3 + topics.length} events.`);
});

console.log(`Seeded users. Admin: ${adminEmail}  User: ${userEmail}`);
await pool.end();
