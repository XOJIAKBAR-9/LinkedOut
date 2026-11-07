import { Router } from "express";
import passport from "passport";
import {
  forgotPasswordSchema,
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@linkedout/shared";
import { env, githubEnabled } from "../config/env.js";
import * as c from "../controllers/auth.controller.js";
import { asyncHandler as h } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate(registerSchema), h(c.register));
authRouter.post("/login", authLimiter, validate(loginSchema), h(c.login));
authRouter.post("/refresh", h(c.refresh));
authRouter.post("/logout", h(c.logout));
authRouter.get("/me", requireAuth, h(c.me));
authRouter.post("/verify-email", validate(verifyEmailSchema), h(c.verifyEmail));
authRouter.post("/resend-verification", requireAuth, authLimiter, h(c.resendVerification));
authRouter.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), h(c.forgotPassword));
authRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), h(c.resetPassword));

// Rate-limited like login: it checks a password.
authRouter.delete("/account", requireAuth, authLimiter, validate(deleteAccountSchema), h(c.deleteAccount));

authRouter.get("/providers", (_req, res) => res.json({ github: githubEnabled }));

if (githubEnabled) {
  authRouter.get("/github", passport.authenticate("github", { session: false }));
  authRouter.get(
    "/github/callback",
    passport.authenticate("github", { session: false, failureRedirect: `${env.WEB_ORIGIN}/login?error=github` }),
    h(c.githubCallback),
  );
}
