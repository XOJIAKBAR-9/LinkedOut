import bcrypt from "bcryptjs";
import type { DeleteAccountInput } from "@linkedout/shared";
import { env } from "../config/env.js";
import { AppError, unauthorized } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import { disconnectUser } from "../socket/realtime.js";

/** Storage key for a URL we stored ourselves; null for anything else (presets, external images). */
function ownStorageKey(url: string | null): string | null {
  const prefix = `${env.API_ORIGIN}/uploads/`;
  return url?.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/**
 * Permanently deletes an account and everything that belongs to it. Requires the current password
 * (or, for GitHub-only accounts, the account email). Most rows go via ON DELETE CASCADE; this function
 * handles what cascades can't: uploaded files, half-empty conversations, shared groups and live sockets.
 */
export async function deleteAccount(userId: string, input: DeleteAccountInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();

  const confirmed = user.passwordHash
    ? Boolean(input.password) && (await bcrypt.compare(input.password!, user.passwordHash))
    : input.email === user.email;
  if (!confirmed) {
    throw new AppError(403, "WRONG_PASSWORD", user.passwordHash ? "Incorrect password" : "Email does not match");
  }

  // Collect uploaded files before the rows that reference them disappear.
  const posts = await prisma.post.findMany({ where: { authorId: userId }, select: { imageUrl: true } });
  const fileKeys = [user.avatarUrl, user.bannerUrl, ...posts.map((p) => p.imageUrl)]
    .map(ownStorageKey)
    .filter((k): k is string => k !== null);

  await prisma.$transaction(async (tx) => {
    // 1:1 conversations would be left with a single participant: remove them entirely.
    const convs = await tx.conversation.findMany({
      where: { participants: { some: { userId } } },
      select: { id: true, _count: { select: { participants: true } } },
    });
    const orphaned = convs.filter((c) => c._count.participants <= 2).map((c) => c.id);
    await tx.conversation.deleteMany({ where: { id: { in: orphaned } } });

    // Groups with other members get a new owner (an admin if there is one, else the longest-standing member).
    const groups = await tx.group.findMany({ where: { ownerId: userId }, select: { id: true } });
    for (const g of groups) {
      const heir = await tx.groupMember.findFirst({
        where: { groupId: g.id, userId: { not: userId } },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
      });
      if (heir) {
        await tx.group.update({ where: { id: g.id }, data: { ownerId: heir.userId } });
        await tx.groupMember.update({
          where: { groupId_userId: { groupId: g.id, userId: heir.userId } },
          data: { role: "ADMIN" },
        });
      }
    }

    // Notifications this user caused for others ("X reacted to your post").
    await tx.notification.deleteMany({ where: { actorId: userId } });

    // Everything else (posts, comments, reactions, connections, messages, memberships,
    // tokens, remaining groups, own notifications) is removed by ON DELETE CASCADE.
    await tx.user.delete({ where: { id: userId } });
  });

  disconnectUser(userId);

  // Files last: if one fails to delete, the account is still gone. Log and move on.
  await Promise.all(
    fileKeys.map((key) => storage.delete(key).catch((err) => logger.warn({ err, key }, "could not delete upload"))),
  );
  logger.info({ userId }, "account deleted");
}
