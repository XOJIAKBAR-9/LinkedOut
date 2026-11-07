import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@linkedout/shared";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

let io: IO | null = null;

export function setIO(server: IO | null) {
  io = server;
}

export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (id: string) => `conversation:${id}`;

/** Closes every open socket of a user (e.g. after their account is deleted). */
export function disconnectUser(userId: string) {
  io?.in(userRoom(userId)).disconnectSockets(true);
}

/** Emits to every socket the user has open. No-op when Socket.IO isn't running (e.g. API tests). */
export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  io?.to(userRoom(userId)).emit(event, ...args);
}
