import type { Request, Response } from "express";
import type { PaginationInput } from "@linkedout/shared";
import { currentUserId } from "../middleware/auth.js";
import { parsedQuery } from "../middleware/validate.js";
import * as messages from "../services/message.service.js";
import * as notifications from "../services/notification.service.js";
import * as searchService from "../services/search.service.js";

export async function listConversations(req: Request, res: Response) {
  res.json({ items: await messages.listConversations(currentUserId(req)) });
}

export async function unreadMessages(req: Request, res: Response) {
  res.json(await messages.unreadSummary(currentUserId(req)));
}

export async function markConversationRead(req: Request, res: Response) {
  await messages.markRead(currentUserId(req), req.params.id as string);
  res.status(204).end();
}

export async function openConversation(req: Request, res: Response) {
  res.json({ conversation: await messages.getOrCreateDirect(currentUserId(req), req.body.userId) });
}

export async function listMessages(req: Request, res: Response) {
  const { cursor, limit } = parsedQuery<PaginationInput>(req);
  res.json(await messages.listMessages(currentUserId(req), req.params.id as string, cursor, limit));
}

export async function sendMessage(req: Request, res: Response) {
  res.status(201).json({ message: await messages.send(currentUserId(req), req.params.id as string, req.body) });
}

export async function editMessage(req: Request, res: Response) {
  const { id, messageId } = req.params as { id: string; messageId: string };
  res.json({ message: await messages.edit(currentUserId(req), id, messageId, req.body.content) });
}

export async function deleteMessage(req: Request, res: Response) {
  const { id, messageId } = req.params as { id: string; messageId: string };
  res.json({ message: await messages.remove(currentUserId(req), id, messageId) });
}

export async function listNotifications(req: Request, res: Response) {
  const { cursor, limit } = parsedQuery<PaginationInput>(req);
  const userId = currentUserId(req);
  const [page, unread] = await Promise.all([
    notifications.list(userId, cursor, limit),
    notifications.unreadCount(userId),
  ]);
  res.json({ ...page, unread });
}

export async function markNotificationRead(req: Request, res: Response) {
  await notifications.markRead(currentUserId(req), req.params.id as string);
  res.status(204).end();
}

export async function markNotificationsRead(req: Request, res: Response) {
  await notifications.markAllRead(currentUserId(req));
  res.status(204).end();
}

export async function suggest(req: Request, res: Response) {
  const { q } = parsedQuery<{ q: string }>(req);
  res.json({ people: await searchService.suggestPeople(q) });
}

export async function search(req: Request, res: Response) {
  const { q, type } = parsedQuery<{ q: string; type: "all" | "people" | "posts" | "companies" }>(req);
  res.json(await searchService.search(q, type));
}
