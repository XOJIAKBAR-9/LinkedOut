import type { AppNotification, Paginated } from "@linkedout/shared";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { publicUserSelect } from "../lib/serializers.js";
import { emitToUser } from "../socket/realtime.js";

const include = {
  actor: { select: publicUserSelect },
  comment: { select: { parentId: true } },
} satisfies Prisma.NotificationInclude;
type Row = Prisma.NotificationGetPayload<{ include: typeof include }>;

const toDto = (n: Row): AppNotification => ({
  id: n.id,
  type: n.type,
  read: n.read,
  createdAt: n.createdAt.toISOString(),
  actor: n.actor,
  entityId: n.entityId,
  postId: n.postId,
  commentId: n.commentId,
  threadId: n.comment?.parentId ?? null,
});

export async function notify(params: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  entityId?: string;
  postId?: string;
  commentId?: string;
}) {
  if (params.recipientId === params.actorId) return;
  const n = await prisma.notification.create({ data: params, include });
  emitToUser(params.recipientId, "notification:new", toDto(n));
}

export async function list(userId: string, cursor: string | undefined, limit: number): Promise<Paginated<AppNotification>> {
  const rows = await prisma.notification.findMany({
    where: { recipientId: userId },
    include,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return { items: page.map(toDto), nextCursor: rows.length > limit ? page.at(-1)!.id : null };
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { recipientId: userId, read: false } });
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, recipientId: userId }, data: { read: true } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { recipientId: userId, read: false }, data: { read: true } });
}
