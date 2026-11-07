import type { AppNotification, Conversation, Message } from "@linkedout/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { useAuth } from "@/stores/auth";

/** Keeps one socket open while signed in and pushes events into the query cache. */
export function useRealtime() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const onMessage = (m: Message) => {
      void qc.invalidateQueries({ queryKey: ["messages", m.conversationId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread"] });
    };
    const onUpdated = (m: Message) => {
      void qc.invalidateQueries({ queryKey: ["messages", m.conversationId] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      void qc.invalidateQueries({ queryKey: ["messages-unread"] });
    };
    // The other person opened the chat: update their read receipt so "Sent" turns into "Seen" instantly.
    const onRead = (p: { conversationId: string; userId: string; lastReadAt: string }) => {
      qc.setQueryData<{ items: Conversation[] }>(["conversations"], (data) =>
        data && {
          items: data.items.map((c) =>
            c.id !== p.conversationId
              ? c
              : { ...c, readReceipts: c.readReceipts.map((r) => (r.userId === p.userId ? { ...r, lastReadAt: p.lastReadAt } : r)) },
          ),
        },
      );
    };
    const onNotification = (_n: AppNotification) => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    };
    socket.on("message:new", onMessage);
    socket.on("message:updated", onUpdated);
    socket.on("conversation:read", onRead);
    socket.on("notification:new", onNotification);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("message:updated", onUpdated);
      socket.off("conversation:read", onRead);
      socket.off("notification:new", onNotification);
    };
  }, [user, qc]);

  useEffect(() => {
    if (!user) disconnectSocket();
  }, [user]);
}
