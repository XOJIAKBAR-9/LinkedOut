import type { CookieOptions, Request, Response } from "express";
import { env, isProd } from "../config/env.js";
import { ACCESS_COOKIE, REFRESH_COOKIE, currentUserId } from "../middleware/auth.js";
import { unauthorized } from "../lib/errors.js";
import * as account from "../services/account.service.js";
import * as auth from "../services/auth.service.js";

const REFRESH_PATH = "/api/v1/auth";

const baseCookie: CookieOptions = { httpOnly: true, secure: isProd, sameSite: "lax" };

export function setSessionCookies(res: Response, tokens: auth.SessionTokens) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseCookie, path: "/", maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookie,
    path: REFRESH_PATH,
    expires: tokens.refreshExpiresAt,
  });
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: REFRESH_PATH });
}

export async function register(req: Request, res: Response) {
  const { user, tokens } = await auth.register(req.body);
  setSessionCookies(res, tokens);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const { user, tokens } = await auth.login(req.body);
  setSessionCookies(res, tokens);
  res.json({ user });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw unauthorized("Session expired", "SESSION_EXPIRED");
  try {
    const { user, tokens } = await auth.refresh(token);
    setSessionCookies(res, tokens);
    res.json({ user });
  } catch (err) {
    clearSessionCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await auth.logout(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await auth.getMe(currentUserId(req)) });
}

export async function verifyEmail(req: Request, res: Response) {
  await auth.verifyEmail(req.body.token);
  res.status(204).end();
}

export async function resendVerification(req: Request, res: Response) {
  await auth.resendVerification(currentUserId(req));
  res.status(204).end();
}

export async function forgotPassword(req: Request, res: Response) {
  await auth.forgotPassword(req.body.email);
  res.status(204).end();
}

export async function resetPassword(req: Request, res: Response) {
  await auth.resetPassword(req.body.token, req.body.password);
  clearSessionCookies(res);
  res.status(204).end();
}

export async function deleteAccount(req: Request, res: Response) {
  await account.deleteAccount(currentUserId(req), req.body);
  clearSessionCookies(res);
  res.status(204).end();
}

/** Final step of GitHub OAuth: passport has put the user on req.user. */
export async function githubCallback(req: Request, res: Response) {
  const user = req.user as { id: string } | undefined;
  if (!user) return res.redirect(`${env.WEB_ORIGIN}/login?error=github`);
  setSessionCookies(res, await auth.createSession(user.id));
  res.redirect(`${env.WEB_ORIGIN}/feed`);
}
