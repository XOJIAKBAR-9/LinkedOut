import type { Request, RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

type Part = "body" | "query" | "params";

/**
 * Validates req[part]. Parsed body/params replace the originals; parsed query
 * goes to res.locals.query (req.query is read-only in Express), read it with parsedQuery().
 */
export const validate =
  (schema: ZodTypeAny, part: Part = "body"): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) return next(result.error);
    if (part === "query") res.locals.query = result.data;
    else req[part] = result.data;
    next();
  };

export function parsedQuery<T>(req: Request): T {
  return req.res!.locals.query as T;
}
