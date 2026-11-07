import bcrypt from "bcryptjs";
import type { AuthUser, LoginInput, RegisterInput } from "@linkedout/shared";
import type { EmailTokenType, User } from "@prisma/client";
import { env, isTest } from "../config/env.js";
import { AppError, badRequest, conflict, unauthorized } from "../lib/errors.js";
import { actionEmail, sendSafely } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import { hashToken, randomToken, signAccessToken } from "../lib/tokens.js";

export const BCRYPT_ROUNDS = isTest ? 4 : 12;
const DAY_MS = 24 * 60 * 60 * 1000;
let dummyHash: string | undefined;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function toAuthUser(u: User): AuthUser {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    hasPassword: Boolean(u.passwordHash),
    firstName: u.firstName,
    lastName: u.lastName,
    headline: u.headline,
    avatarUrl: u.avatarUrl,
    location: u.location,
  };
}

export async function createSession(userId: string): Promise<SessionTokens> {
  const refreshToken = randomToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * DAY_MS);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt },
  });
  return { accessToken: signAccessToken(userId), refreshToken, refreshExpiresAt };
}

async function issueEmailToken(userId: string, type: EmailTokenType, ttlMs: number): Promise<string> {
  const token = randomToken();
  await prisma.emailToken.create({
    data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

async function consumeEmailToken(token: string, type: EmailTokenType) {
  const record = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest("This link is invalid or has expired", "INVALID_TOKEN");
  }
  await prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record;
}

/** Returns false if the email couldn't be delivered (the failure is logged). Never throws for mail errors. */
async function sendVerificationEmail(user: User): Promise<boolean> {
  const token = await issueEmailToken(user.id, "VERIFY_EMAIL", DAY_MS);
  const url = `${env.WEB_ORIGIN}/verify-email?token=${token}`;
  return sendSafely({
    to: user.email,
    subject: "Verify your LinkedOut email",
    text: `Hi ${user.firstName}, confirm your email: ${url}`,
    html: actionEmail({
      heading: `Hi ${user.firstName}, confirm your email`,
      body: "Click the button below to verify your email address. The link is valid for 24 hours.",
      button: "Verify email",
      url,
      footer: "If you didn't create a LinkedOut account, you can ignore this email.",
    }),
  });
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with this email already exists", "EMAIL_TAKEN");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    },
  });
  // The account exists now; a mail problem must not turn sign-up into an error.
  // The user can resend the verification email from the banner in the app.
  await sendVerificationEmail(user);
  return { user: toAuthUser(user), tokens: await createSession(user.id) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Compare against a dummy hash when the user doesn't exist to keep timing similar.
  const hash = user?.passwordHash ?? (dummyHash ??= await bcrypt.hash("no-such-user", BCRYPT_ROUNDS));
  const ok = await bcrypt.compare(input.password, hash);
  if (!user || !user.passwordHash || !ok) throw unauthorized("Incorrect email or password", "INVALID_CREDENTIALS");
  return { user: toAuthUser(user), tokens: await createSession(user.id) };
}

/** Rotates the refresh token. Reusing a revoked token revokes every session for that user. */
export async function refresh(refreshToken: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!record) throw unauthorized("Session expired", "SESSION_EXPIRED");
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized("Session expired", "SESSION_EXPIRED");
  }
  if (record.expiresAt < new Date()) throw unauthorized("Session expired", "SESSION_EXPIRED");

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return { user: toAuthUser(record.user), tokens: await createSession(record.userId) };
}

export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  return toAuthUser(user);
}

export async function verifyEmail(token: string) {
  const record = await consumeEmailToken(token, "VERIFY_EMAIL");
  await prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } });
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerified) throw badRequest("Email is already verified");
  if (!(await sendVerificationEmail(user))) {
    throw new AppError(502, "EMAIL_NOT_SENT", "The verification email could not be sent");
  }
}

/** Always succeeds so the endpoint can't be used to check which emails have accounts. */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const token = await issueEmailToken(user.id, "RESET_PASSWORD", 60 * 60 * 1000);
  const url = `${env.WEB_ORIGIN}/reset-password?token=${token}`;
  // A delivery failure is logged, not returned: the response must look the same either way.
  await sendSafely({
    to: user.email,
    subject: "Reset your LinkedOut password",
    text: `Reset your password (valid for 1 hour): ${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: actionEmail({
      heading: `Reset your password, ${user.firstName}`,
      body: "We got a request to reset your LinkedOut password. The link is valid for 1 hour.",
      button: "Choose a new password",
      url,
      footer: "If you didn't ask for this, you can ignore this email — your password won't change.",
    }),
  });
}

export async function resetPassword(token: string, password: string) {
  const record = await consumeEmailToken(token, "RESET_PASSWORD");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    }),
    // Sign out everywhere after a password reset.
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export interface GithubProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** Finds the user by GitHub id, links by verified email, or creates a new account. */
export async function upsertGithubUser(profile: GithubProfile): Promise<User> {
  const byGithub = await prisma.user.findUnique({ where: { githubId: profile.id } });
  if (byGithub) return byGithub;

  if (!profile.email) throw badRequest("Your GitHub account has no public verified email");

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { githubId: profile.id, emailVerified: true, avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl },
    });
  }

  const [firstName, ...rest] = (profile.displayName ?? profile.username ?? "GitHub User").split(" ");
  return prisma.user.create({
    data: {
      email: profile.email.toLowerCase(),
      githubId: profile.id,
      emailVerified: true,
      firstName: firstName || "GitHub",
      lastName: rest.join(" ") || "User",
      avatarUrl: profile.avatarUrl,
    },
  });
}
