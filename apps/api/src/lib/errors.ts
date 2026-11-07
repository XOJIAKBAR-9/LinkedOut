import type { ApiErrorCode } from "@linkedout/shared";

/** `message` is for developers/logs; clients translate by `code`. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code: ApiErrorCode = "BAD_REQUEST") =>
  new AppError(400, code, message);
export const unauthorized = (message = "Authentication required", code: ApiErrorCode = "UNAUTHORIZED") =>
  new AppError(401, code, message);
export const forbidden = (message = "You don't have access to this") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (message: string, code: ApiErrorCode = "CONFLICT") => new AppError(409, code, message);
