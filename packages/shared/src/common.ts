import { z } from "zod";

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** Every error code the API can return. The web app has a translation for each. */
export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UPLOAD_ERROR",
  "INVALID_FILE_TYPE",
  "UNAUTHORIZED",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "INVALID_TOKEN",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "EMAIL_TAKEN",
  "ALREADY_CONNECTED",
  "REQUEST_PENDING",
  "RATE_LIMITED",
  "EMAIL_NOT_SENT",
  "WRONG_PASSWORD",
  "EDIT_EXPIRED",
  "INTERNAL",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const suggestSchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(["all", "people", "posts", "companies"]).default("all"),
});
