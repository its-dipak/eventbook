import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../lib/errors.js";
import { pool } from "../lib/db.js";
import { handle } from "../lib/http.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

// Slows down password guessing. Disabled under test so tests can log in freely.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (_req, res) => {
    res.status(429).json({ error: { code: "too_many_attempts", message: "Too many login attempts. Try again later." } });
  },
});

function publicUser(row: { id: string; name: string; email: string; role: "user" | "admin" }) {
  return { id: Number(row.id), name: row.name, email: row.email, role: row.role };
}

// Registration always creates a normal user. Admins exist only via the seed script.
authRouter.post(
  "/register",
  handle(async (req, res) => {
    const { name, email, password } = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email, role`,
        [name, email, passwordHash],
      );
      const user = publicUser(rows[0]);
      res.status(201).json({ user, token: signToken({ id: user.id, role: user.role }) });
    } catch (err: any) {
      if (err.code === "23505") throw new HttpError(409, "email_taken", "An account with this email already exists");
      throw err;
    }
  }),
);

authRouter.post(
  "/login",
  loginLimiter,
  handle(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await pool.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = $1",
      [email],
    );
    const row = rows[0];
    // Same message for unknown email and wrong password, so emails can't be probed.
    const ok = row ? await bcrypt.compare(password, row.password_hash) : false;
    if (!ok) throw new HttpError(401, "invalid_credentials", "Incorrect email or password");
    const user = publicUser(row);
    res.json({ user, token: signToken({ id: user.id, role: user.role }) });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  handle(async (req, res) => {
    const { rows } = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1", [req.auth!.id]);
    if (!rows[0]) throw new HttpError(401, "unauthorized", "Your session is invalid or has expired");
    res.json({ user: publicUser(rows[0]) });
  }),
);
