import { Router } from "express";
import { createCommentSchema, listCommentsSchema, paginationSchema, reactSchema } from "@linkedout/shared";
import * as c from "../controllers/post.controller.js";
import { asyncHandler as h } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { imageUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

export const postRouter = Router();
postRouter.use(requireAuth);

postRouter.get("/", validate(paginationSchema, "query"), h(c.feed));
postRouter.get("/insights", h(c.insights));
// Body is validated in the controller because multer parses it after the route matches.
postRouter.post("/", imageUpload.single("image"), h(c.create));
postRouter.get("/:id", h(c.get));
postRouter.delete("/:id", h(c.remove));
postRouter.put("/:id/reaction", validate(reactSchema), h(c.react));
postRouter.delete("/:id/reaction", h(c.unreact));
postRouter.get("/:id/comments", validate(listCommentsSchema, "query"), h(c.listComments));
postRouter.post("/:id/comments", validate(createCommentSchema), h(c.addComment));
postRouter.delete("/:id/comments/:commentId", h(c.deleteComment));
