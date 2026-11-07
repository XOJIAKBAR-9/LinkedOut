import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { conversationRouter, notificationRouter, searchRouter } from "./misc.routes.js";
import { postRouter } from "./post.routes.js";
import { connectionRouter, userRouter } from "./user.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/connections", connectionRouter);
apiRouter.use("/posts", postRouter);
apiRouter.use("/conversations", conversationRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/search", searchRouter);
