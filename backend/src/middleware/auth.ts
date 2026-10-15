import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";

export interface AuthUser {
  id: number;
  role: "user" | "admin";
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, { subject: String(user.id), expiresIn: "7d" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "unauthorized", "Please log in to continue"));
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    req.auth = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    next(new HttpError(401, "unauthorized", "Your session is invalid or has expired"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.role !== "admin") {
    return next(new HttpError(403, "forbidden", "Admin access required"));
  }
  next();
}
