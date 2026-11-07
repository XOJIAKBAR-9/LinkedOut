import { Router } from "express";
import { z } from "zod";
import { editMessageSchema, paginationSchema, searchSchema, sendMessageSchema, suggestSchema } from "@linkedout/shared";
import * as c from "../controllers/misc.controller.js";
import { asyncHandler as h } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

export const conversationRouter = Router();
conversationRouter.use(requireAuth);
conversationRouter.get("/", h(c.listConversations));
conversationRouter.get("/unread", h(c.unreadMessages));
conversationRouter.post("/:id/read", h(c.markConversationRead));
conversationRouter.post("/", validate(z.object({ userId: z.string().min(1) })), h(c.openConversation));
conversationRouter.get("/:id/messages", validate(paginationSchema, "query"), h(c.listMessages));
conversationRouter.post("/:id/messages", validate(sendMessageSchema), h(c.sendMessage));
conversationRouter.patch("/:id/messages/:messageId", validate(editMessageSchema), h(c.editMessage));
conversationRouter.delete("/:id/messages/:messageId", h(c.deleteMessage));

export const notificationRouter = Router();
notificationRouter.use(requireAuth);
notificationRouter.get("/", validate(paginationSchema, "query"), h(c.listNotifications));
notificationRouter.post("/read", h(c.markNotificationsRead));
notificationRouter.post("/:id/read", h(c.markNotificationRead));

export const searchRouter = Router();
searchRouter.use(requireAuth);
searchRouter.get("/", validate(searchSchema, "query"), h(c.search));
searchRouter.get("/suggest", validate(suggestSchema, "query"), h(c.suggest));
