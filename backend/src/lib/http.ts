import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const idParam = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
