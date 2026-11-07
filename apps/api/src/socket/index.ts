import type http from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { ACCESS_COOKIE } from "../middleware/auth.js";
import { type IO, setIO, userRoom } from "./realtime.js";

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

interface SocketData {
  userId: string;
}

/** Authenticates sockets with the same access-token JWT as the REST API (cookie or `auth.token`). */
export function createSocketServer(server: http.Server): IO {
  const io: IO = new Server(server, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
    path: "/socket.io",
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      cookieValue(socket.handshake.headers.cookie, ACCESS_COOKIE);
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) return next(new Error("UNAUTHORIZED"));
    (socket.data as SocketData).userId = payload.sub;
    next();
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data as SocketData;
    void socket.join(userRoom(userId));
    logger.debug({ userId }, "socket connected");

    socket.on("typing", async ({ conversationId, isTyping }) => {
      if (typeof conversationId !== "string") return;
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId },
        select: { userId: true },
      });
      if (!participants.some((p) => p.userId === userId)) return;
      for (const p of participants) {
        if (p.userId !== userId) {
          io.to(userRoom(p.userId)).emit("typing", { conversationId, userId, isTyping: Boolean(isTyping) });
        }
      }
    });
  });

  setIO(io);
  return io;
}
