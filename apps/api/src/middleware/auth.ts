import type { RequestHandler } from "express";
import { unauthorized } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";

export const ACCESS_COOKIE = "lo_access";
export const REFRESH_COOKIE = "lo_refresh";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function readToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE];
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) return next(unauthorized());
  req.userId = payload.sub;
  next();
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  const payload = token ? verifyAccessToken(token) : null;
  if (payload) req.userId = payload.sub;
  next();
};

/** Use after requireAuth. */
export function currentUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
