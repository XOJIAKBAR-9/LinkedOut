import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import passport from "passport";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { configurePassport } from "./config/passport.js";
import { openapi } from "./docs/openapi.js";
import { logger } from "./lib/logger.js";
import { uploadRoot } from "./lib/storage.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  configurePassport();

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/v1/health" } }));
  app.use(
    helmet({
      // Uploaded images are loaded by the web app on another origin.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(passport.initialize());

  app.use("/uploads", express.static(uploadRoot, { maxAge: "7d", fallthrough: false }));

  // Swagger UI needs inline scripts/styles, so relax CSP only on the docs route.
  app.use(
    "/api/docs",
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openapi, { swaggerOptions: { withCredentials: true } }),
  );
  app.get("/api/openapi.json", (_req, res) => res.json(openapi));

  app.use("/api/v1", apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
