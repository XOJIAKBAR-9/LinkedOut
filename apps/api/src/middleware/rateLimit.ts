import rateLimit from "express-rate-limit";
import { isTest } from "../config/env.js";

const skip = () => isTest;

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
});

/** Stricter limit for login, register and password reset. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again in a few minutes." } },
});
