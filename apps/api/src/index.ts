import http from "node:http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { mailer, SmtpMailer } from "./lib/mailer.js";
import { prisma } from "./lib/prisma.js";
import { createSocketServer } from "./socket/index.js";

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

server.listen(env.PORT, () => {
  logger.info(`API listening on ${env.API_ORIGIN} (docs at ${env.API_ORIGIN}/api/docs)`);
  if (mailer instanceof SmtpMailer) void mailer.verify();
  else logger.warn("SMTP is not configured: emails are printed here instead of being sent (see SMTP_* in .env)");
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  io.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
