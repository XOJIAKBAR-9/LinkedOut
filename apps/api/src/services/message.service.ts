import {
  type Conversation,
  MESSAGE_EDIT_WINDOW_MS,
  type Message,
  type Paginated,
  type SendMessageInput,
  type UnreadSummary,
} from "@linkedout/shared";
import { Prisma } from "@prisma/client";
import { AppError, badRequest, forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { publicUserSelect } from "../lib/serializers.js";
import { emitToUser } from "../socket/realtime.js";

type MessageRow = Prisma.MessageGetPayload<object>;

const toMessage = (m: MessageRow): Message => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  type: m.type,
  content: m.deletedAt ? "" : m.content,
  stickerId: m.deletedAt ? null : m.stickerId,
  createdAt: m.createdAt.toISOString(),
  editedAt: m.editedAt?.toISOString() ?? null,
  deletedAt: m.deletedAt?.toISOString() ?? null,
});

const conversationInclude = {
  participants: { include: { user: { select: publicUserSelect } } },
  messages: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

const toConversation = (c: ConversationRow, unreadCount = 0): Conversation => ({
  id: c.id,
  participants: c.participants.map((p) => p.user),
  lastMessage: c.messages[0] ? toMessage(c.messages[0]) : null,
  updatedAt: c.updatedAt.toISOString(),
  unreadCount,
  readReceipts: c.participants.map((p) => ({ userId: p.userId, lastReadAt: p.lastReadAt?.toISOString() ?? null })),
});

async function participantIds(conversationId: string): Promise<string[]> {
  const rows = await prisma.conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

/** Records that `userId` has read the conversation up to now and tells the other participants ("Seen"). */
async function recordRead(userId: string, conversationId: string) {
  const lastReadAt = new Date();
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt },
  });
  for (const other of await participantIds(conversationId)) {
    if (other !== userId) {
      emitToUser(other, "conversation:read", { conversationId, userId, lastReadAt: lastReadAt.toISOString() });
    }
  }
}

/**
 * Unread message counts per conversation for one user: messages from other people
 * newer than the user's `lastReadAt` in that conversation.
 */
async function unreadByConversation(userId: string, conversationId?: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ conversationId: string; count: bigint }[]>`
    SELECT m."conversationId", COUNT(*) AS count
    FROM "Message" m
    JOIN "ConversationParticipant" cp ON cp."conversationId" = m."conversationId" AND cp."userId" = ${userId}
    WHERE m."senderId" <> ${userId}
      AND m."deletedAt" IS NULL
      AND m."createdAt" > COALESCE(cp."lastReadAt", 'epoch'::timestamp)
      ${conversationId ? Prisma.sql`AND m."conversationId" = ${conversationId}` : Prisma.empty}
    GROUP BY m."conversationId"`;
  return new Map(rows.map((r) => [r.conversationId, Number(r.count)]));
}

export async function unreadSummary(userId: string): Promise<UnreadSummary> {
  const counts = [...(await unreadByConversation(userId)).values()];
  return { conversations: counts.length, messages: counts.reduce((a, b) => a + b, 0) };
}

/** Marks a conversation as read up to now (used when the thread is open and a new message arrives). */
export async function markRead(userId: string, conversationId: string) {
  await assertParticipant(userId, conversationId);
  await recordRead(userId, conversationId);
}

export async function assertParticipant(userId: string, conversationId: string) {
  const p = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!p) throw notFound("Conversation");
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: conversationInclude,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const unread = await unreadByConversation(userId);
  return rows.map((c) => toConversation(c, unread.get(c.id) ?? 0));
}

/** Returns the 1:1 conversation between two users, creating it if needed. */
export async function getOrCreateDirect(userId: string, otherId: string): Promise<Conversation> {
  if (userId === otherId) throw badRequest("You can't message yourself");
  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
  if (!other) throw notFound("User");

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [{ participants: { some: { userId } } }, { participants: { some: { userId: otherId } } }],
      participants: { every: { userId: { in: [userId, otherId] } } },
    },
    include: conversationInclude,
  });
  if (existing) return toConversation(existing, (await unreadByConversation(userId, existing.id)).get(existing.id) ?? 0);

  const created = await prisma.conversation.create({
    data: { participants: { create: [{ userId }, { userId: otherId }] } },
    include: conversationInclude,
  });
  return toConversation(created);
}

export async function listMessages(
  userId: string,
  conversationId: string,
  cursor: string | undefined,
  limit: number,
): Promise<Paginated<Message>> {
  await assertParticipant(userId, conversationId);
  // Newest first; the client reverses for display and pages backwards in time.
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  // Loading the newest page means the user is looking at the conversation.
  if (!cursor) await recordRead(userId, conversationId);
  return { items: items.map(toMessage), nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

export async function send(userId: string, conversationId: string, input: SendMessageInput): Promise<Message> {
  await assertParticipant(userId, conversationId);
  const data =
    "stickerId" in input
      ? { type: "STICKER" as const, content: "", stickerId: input.stickerId }
      : { type: "TEXT" as const, content: input.content };
  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId: userId, ...data } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  const dto = toMessage(message);
  for (const id of await participantIds(conversationId)) emitToUser(id, "message:new", dto);
  return dto;
}

/** Loads a message the user sent in this conversation, or throws. */
async function ownMessage(userId: string, conversationId: string, messageId: string) {
  await assertParticipant(userId, conversationId);
  const m = await prisma.message.findUnique({ where: { id: messageId } });
  if (!m || m.conversationId !== conversationId || m.deletedAt) throw notFound("Message");
  if (m.senderId !== userId) throw forbidden("You can only change your own messages");
  return m;
}

async function broadcastUpdate(message: MessageRow) {
  const dto = toMessage(message);
  for (const id of await participantIds(message.conversationId)) emitToUser(id, "message:updated", dto);
  return dto;
}

/** Edits the text of your own message within MESSAGE_EDIT_WINDOW_MS of sending it. */
export async function edit(userId: string, conversationId: string, messageId: string, content: string): Promise<Message> {
  const m = await ownMessage(userId, conversationId, messageId);
  if (m.type !== "TEXT") throw badRequest("Stickers can't be edited");
  if (Date.now() - m.createdAt.getTime() > MESSAGE_EDIT_WINDOW_MS) {
    throw new AppError(403, "EDIT_EXPIRED", "Messages can only be edited for 15 minutes");
  }
  if (m.content === content) return toMessage(m);
  return broadcastUpdate(await prisma.message.update({ where: { id: m.id }, data: { content, editedAt: new Date() } }));
}

/** Deletes your own message for everyone: the text/sticker is wiped and it shows as "deleted". */
export async function remove(userId: string, conversationId: string, messageId: string): Promise<Message> {
  const m = await ownMessage(userId, conversationId, messageId);
  return broadcastUpdate(
    await prisma.message.update({ where: { id: m.id }, data: { deletedAt: new Date(), content: "", stickerId: null } }),
  );
}
