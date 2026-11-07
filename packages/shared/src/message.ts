import { z } from "zod";
import type { PublicUser } from "./user.js";

/** Built-in sticker pack. Images live in the web app at /stickers/<id>.svg; labels are translated. */
export const STICKERS = [
  "wave",
  "thumbs-up",
  "party",
  "coffee",
  "rocket",
  "trophy",
  "idea",
  "heart",
  "laugh",
  "thinking",
  "fire",
  "done",
] as const;
export type StickerId = (typeof STICKERS)[number];
export const stickerUrl = (id: string) => `/stickers/${id}.svg`;

/** Send either text or a sticker. */
export const sendMessageSchema = z.union([
  z.object({ content: z.string().trim().min(1).max(5000) }).strict(),
  z.object({ stickerId: z.enum(STICKERS) }).strict(),
]);
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

/** Messages can be edited for this long after sending (deleting is always allowed). */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "STICKER";
  /** Empty for stickers and deleted messages. */
  content: string;
  stickerId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

/** When each participant last read the conversation (for "Seen" receipts). */
export interface ReadReceipt {
  userId: string;
  lastReadAt: string | null;
}

export interface Conversation {
  id: string;
  participants: PublicUser[];
  lastMessage: Message | null;
  updatedAt: string;
  /** Messages from others since you last opened this conversation. */
  unreadCount: number;
  /** Read state of every participant; a message is "Seen" once the other person's lastReadAt passes it. */
  readReceipts: ReadReceipt[];
}

/** Badge data for the Messaging tab. */
export interface UnreadSummary {
  /** Conversations (people) with at least one unread message — the number on the badge. */
  conversations: number;
  /** Total unread messages across all conversations. */
  messages: number;
}

/** Socket.IO event contracts, shared by client and server. */
export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  /** A message was edited or deleted. */
  "message:updated": (message: Message) => void;
  /** Someone opened the conversation: messages before `lastReadAt` are now seen by them. */
  "conversation:read": (payload: { conversationId: string; userId: string; lastReadAt: string }) => void;
  "typing": (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
  "notification:new": (notification: AppNotification) => void;
}

export interface ClientToServerEvents {
  "typing": (payload: { conversationId: string; isTyping: boolean }) => void;
  "conversation:join": (conversationId: string) => void;
}

export interface AppNotification {
  id: string;
  type: "REACTION" | "COMMENT" | "REPLY" | "CONNECTION_REQUEST" | "CONNECTION_ACCEPTED" | "MESSAGE";
  read: boolean;
  createdAt: string;
  actor: PublicUser | null;
  /** Connection id for CONNECTION_* notifications. */
  entityId: string | null;
  /** Post to open (REACTION, COMMENT, REPLY). */
  postId: string | null;
  /** Comment or reply to scroll to and highlight (COMMENT, REPLY). */
  commentId: string | null;
  /** Top-level comment whose replies must be expanded to show `commentId` (REPLY, or COMMENT that is a reply). */
  threadId: string | null;
}
