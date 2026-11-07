import { Router } from "express";
import { paginationSchema, updateProfileSchema } from "@linkedout/shared";
import * as c from "../controllers/user.controller.js";
import { asyncHandler as h } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { imageUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";

export const userRouter = Router();
userRouter.use(requireAuth);

userRouter.patch("/me", validate(updateProfileSchema), h(c.updateMe));
userRouter.post("/me/avatar", imageUpload.single("image"), h(c.uploadImage("avatar")));
userRouter.post("/me/banner", imageUpload.single("image"), h(c.uploadImage("banner")));
userRouter.get("/:id", h(c.getProfile));
userRouter.get("/:id/experience", h(c.getExperience));
userRouter.get("/:id/posts", validate(paginationSchema, "query"), h(c.getPosts));
userRouter.post("/:id/connect", h(c.requestConnection));

export const connectionRouter = Router();
connectionRouter.use(requireAuth);

connectionRouter.get("/", h(c.listConnections));
connectionRouter.get("/pending", h(c.listPending));
connectionRouter.post("/:id/accept", h(c.acceptConnection));
connectionRouter.delete("/:id", h(c.removeConnection));
