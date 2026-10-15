import cors from "cors";
import express from "express";
import { config } from "./lib/config.js";
import { errorHandler, HttpError } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { bookingsRouter } from "./routes/bookings.js";
import { eventsRouter } from "./routes/events.js";

export const app = express();

app.set("trust proxy", 1); // behind Render's proxy, so rate limiting sees the real client IP
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/events", eventsRouter);
app.use(bookingsRouter); // /events/:id/bookings, /me/bookings, /bookings/:id

app.use((_req, _res, next) => next(new HttpError(404, "not_found", "Route not found")));
app.use(errorHandler);
