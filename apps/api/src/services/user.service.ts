import type { UpdateProfileInput, UserProfile } from "@linkedout/shared";
import { notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import { toAuthUser } from "./auth.service.js";

export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User");
  const connectionCount = await prisma.connection.count({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
  });
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    headline: user.headline,
    avatarUrl: user.avatarUrl,
    location: user.location,
    about: user.about,
    bannerUrl: user.bannerUrl,
    createdAt: user.createdAt.toISOString(),
    connectionCount,
  };
}

export async function getExperience(userId: string) {
  return prisma.experience.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
    include: { company: { select: { id: true, name: true, slug: true, logoUrl: true } } },
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.update({ where: { id: userId }, data: input });
  return toAuthUser(user);
}

export async function setImage(userId: string, kind: "avatar" | "banner", file: Express.Multer.File) {
  const stored = await storage.save(file.buffer, file.originalname, `${kind}s`);
  const user = await prisma.user.update({
    where: { id: userId },
    data: kind === "avatar" ? { avatarUrl: stored.url } : { bannerUrl: stored.url },
  });
  return toAuthUser(user);
}
