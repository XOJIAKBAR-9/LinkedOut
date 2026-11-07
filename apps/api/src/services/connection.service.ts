import { badRequest, conflict, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { publicUserSelect } from "../lib/serializers.js";
import { notify } from "./notification.service.js";

export async function request(fromId: string, toId: string) {
  if (fromId === toId) throw badRequest("You can't connect with yourself");
  const target = await prisma.user.findUnique({ where: { id: toId }, select: { id: true } });
  if (!target) throw notFound("User");

  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: fromId, addresseeId: toId },
        { requesterId: toId, addresseeId: fromId },
      ],
    },
  });
  if (existing) throw existing.status === "ACCEPTED"
      ? conflict("Already connected", "ALREADY_CONNECTED")
      : conflict("Request already pending", "REQUEST_PENDING");

  const connection = await prisma.connection.create({ data: { requesterId: fromId, addresseeId: toId } });
  await notify({ recipientId: toId, actorId: fromId, type: "CONNECTION_REQUEST", entityId: connection.id });
  return connection;
}

export async function accept(userId: string, connectionId: string) {
  const c = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!c || c.addresseeId !== userId || c.status !== "PENDING") throw notFound("Connection request");
  const updated = await prisma.connection.update({ where: { id: c.id }, data: { status: "ACCEPTED" } });
  await notify({ recipientId: c.requesterId, actorId: userId, type: "CONNECTION_ACCEPTED", entityId: c.id });
  return updated;
}

/** Declines a pending request, cancels one you sent, or removes an existing connection. */
export async function remove(userId: string, connectionId: string) {
  const c = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!c || (c.requesterId !== userId && c.addresseeId !== userId)) throw notFound("Connection");
  await prisma.connection.delete({ where: { id: c.id } });
}

export async function listConnections(userId: string) {
  const rows = await prisma.connection.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: { requester: { select: publicUserSelect }, addressee: { select: publicUserSelect } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((c) => ({
    id: c.id,
    since: c.updatedAt.toISOString(),
    user: c.requesterId === userId ? c.addressee : c.requester,
  }));
}

export async function listPending(userId: string) {
  const rows = await prisma.connection.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    include: { requester: { select: publicUserSelect } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((c) => ({ id: c.id, createdAt: c.createdAt.toISOString(), user: c.requester }));
}

/** IDs of users the given user is connected to (used to build the feed). */
export async function connectedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.connection.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}
