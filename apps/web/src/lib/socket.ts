import type { ClientToServerEvents, ServerToClientEvents } from "@linkedout/shared";
import { io, type Socket } from "socket.io-client";
import { api } from "./api";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Connects with the httpOnly access cookie (same origin via the Vite proxy). */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({ path: "/socket.io", withCredentials: true, autoConnect: false });
    socket.on("connect_error", async (err) => {
      // Access token expired: refresh the cookie, then reconnect once.
      if (err.message === "UNAUTHORIZED" && (await api.refreshSession())) socket?.connect();
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
