import {
  type Comment,
  type CreatePostData,
  type FeedInsights,
  type Paginated,
  type Post,
  QUIT_REASONS,
  type QuitReason,
  REACTION_TYPES,
  type ReactionType,
} from "@linkedout/shared";
import type { Prisma } from "@prisma/client";
import { forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { publicUserSelect } from "../lib/serializers.js";
import { storage } from "../lib/storage.js";
import { connectedUserIds } from "./connection.service.js";
import { notify } from "./notification.service.js";

const postInclude = (viewerId: string) =>
  ({
    author: { select: publicUserSelect },
    company: { select: { id: true, name: true, slug: true } },
    _count: { select: { comments: true, reactions: true } },
    reactions: { where: { userId: viewerId }, select: { type: true }, take: 1 },
  }) satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

const emptyCounts = (): Record<ReactionType, number> =>
  Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<ReactionType, number>;

/** Reaction counts per type for a set of posts, in one query. */
async function reactionCountsFor(postIds: string[]) {
  const map = new Map<string, Record<ReactionType, number>>();
  if (postIds.length === 0) return map;
  const rows = await prisma.reaction.groupBy({ by: ["postId", "type"], where: { postId: { in: postIds } }, _count: true });
  for (const r of rows) {
    const counts = map.get(r.postId) ?? emptyCounts();
    counts[r.type] = r._count;
    map.set(r.postId, counts);
  }
  return map;
}

const isReason = (r: string): r is QuitReason => (QUIT_REASONS as readonly string[]).includes(r);

/** Anonymous posts never expose their author to anyone but the author. */
const toPost = (p: PostRow, viewerId: string, counts?: Record<ReactionType, number>): Post => {
  const isMine = p.authorId === viewerId;
  return {
    id: p.id,
    type: p.type,
    headline: p.headline,
    content: p.content,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    author: p.anonymous && !isMine ? null : p.author,
    anonymous: p.anonymous,
    isMine,
    companyName: p.companyName,
    company: p.company,
    role: p.role,
    tenureMonths: p.tenureMonths,
    reasons: p.reasons.filter(isReason),
    commentCount: p._count.comments,
    reactionCount: p._count.reactions,
    reactionCounts: counts ?? emptyCounts(),
    myReaction: p.reactions[0]?.type ?? null,
  };
};

async function toPosts(rows: PostRow[], viewerId: string): Promise<Post[]> {
  const counts = await reactionCountsFor(rows.map((r) => r.id));
  return rows.map((r) => toPost(r, viewerId, counts.get(r.id)));
}

async function page(
  viewerId: string,
  where: Prisma.PostWhereInput,
  cursor: string | undefined,
  limit: number,
): Promise<Paginated<Post>> {
  const rows = await prisma.post.findMany({
    where,
    include: postInclude(viewerId),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  return { items: await toPosts(items, viewerId), nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

/**
 * Updates from you and your connections, plus every quit story, warning and red flag
 * (those are public-interest posts, so they're shown to everyone). Users with no
 * connections yet see everything so the feed is never empty on day one.
 */
export async function feed(viewerId: string, cursor: string | undefined, limit: number) {
  const network = await connectedUserIds(viewerId);
  const where: Prisma.PostWhereInput =
    network.length > 0
      ? { groupId: null, OR: [{ authorId: { in: [viewerId, ...network] } }, { type: { not: "UPDATE" } }] }
      : { groupId: null };
  return page(viewerId, where, cursor, limit);
}

/** A person's posts. Their anonymous posts are only listed for themselves. */
export async function byAuthor(viewerId: string, authorId: string, cursor: string | undefined, limit: number) {
  const where: Prisma.PostWhereInput = { authorId, groupId: null, ...(viewerId === authorId ? {} : { anonymous: false }) };
  return page(viewerId, where, cursor, limit);
}

export async function getPost(viewerId: string, postId: string): Promise<Post> {
  const p = await prisma.post.findUnique({ where: { id: postId }, include: postInclude(viewerId) });
  if (!p) throw notFound("Post");
  const [post] = await toPosts([p], viewerId);
  return post!;
}

/** Links a typed post to a known company when the name matches (case-insensitive). */
async function findCompanyId(name: string | undefined) {
  if (!name) return null;
  const c = await prisma.company.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  return c?.id ?? null;
}

export async function create(authorId: string, data: CreatePostData, image?: Express.Multer.File): Promise<Post> {
  const imageUrl = image ? (await storage.save(image.buffer, image.originalname, "posts")).url : null;
  const p = await prisma.post.create({
    data: {
      authorId,
      imageUrl,
      type: data.type,
      headline: data.headline ?? null,
      content: data.content,
      companyName: data.companyName ?? null,
      companyId: await findCompanyId(data.companyName),
      role: data.role ?? null,
      tenureMonths: data.tenureMonths ?? null,
      reasons: data.reasons,
      anonymous: data.anonymous,
    },
    include: postInclude(authorId),
  });
  const [post] = await toPosts([p], authorId);
  return post!;
}

/** Sidebar data: most-warned companies this week, trending quit reasons, and your own quit counter. */
export async function insights(viewerId: string): Promise<FeedInsights> {
  const week = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const month = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [warned, reasons, myQuits] = await Promise.all([
    prisma.$queryRaw<{ name: string; slug: string | null; count: bigint }[]>`
      SELECT COALESCE(c.name, MIN(p."companyName")) AS name, c.slug, COUNT(*) AS count
      FROM "Post" p LEFT JOIN "Company" c ON c.id = p."companyId"
      WHERE p.type IN ('WARNING', 'RED_FLAG') AND p."createdAt" >= ${week} AND p."companyName" IS NOT NULL
      GROUP BY COALESCE(c.id, lower(p."companyName")), c.name, c.slug
      ORDER BY count DESC, name ASC
      LIMIT 5`,
    prisma.$queryRaw<{ reason: string; count: bigint }[]>`
      SELECT r AS reason, COUNT(*) AS count
      FROM "Post" p, unnest(p.reasons) AS r
      WHERE p.type = 'QUIT' AND p."createdAt" >= ${month}
      GROUP BY r ORDER BY count DESC, r ASC LIMIT 6`,
    prisma.post.findMany({
      where: { authorId: viewerId, type: "QUIT" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, companyName: true },
    }),
  ]);

  return {
    mostWarned: warned.map((w) => ({ name: w.name, slug: w.slug, count: Number(w.count) })),
    trendingReasons: reasons.filter((r) => isReason(r.reason)).map((r) => ({ reason: r.reason as QuitReason, count: Number(r.count) })),
    me: {
      lastQuitAt: myQuits[0]?.createdAt.toISOString() ?? null,
      lastQuitCompany: myQuits[0]?.companyName ?? null,
      quitCount: myQuits.length,
    },
  };
}

export async function remove(userId: string, postId: string) {
  const p = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!p) throw notFound("Post");
  if (p.authorId !== userId) throw forbidden("You can only delete your own posts");
  await prisma.post.delete({ where: { id: postId } });
}

export async function react(userId: string, postId: string, type: ReactionType) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) throw notFound("Post");
  const existing = await prisma.reaction.findUnique({ where: { postId_userId: { postId, userId } } });
  await prisma.reaction.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId, type },
    update: { type },
  });
  if (!existing) await notify({ recipientId: post.authorId, actorId: userId, type: "REACTION", postId });
  return getPost(userId, postId);
}

export async function unreact(userId: string, postId: string) {
  await prisma.reaction.deleteMany({ where: { postId, userId } });
  return getPost(userId, postId);
}

const commentInclude = {
  author: { select: publicUserSelect },
  replyTo: { select: publicUserSelect },
  _count: { select: { replies: true } },
} satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

const toComment = (c: CommentRow): Comment => ({
  id: c.id,
  content: c.content,
  createdAt: c.createdAt.toISOString(),
  author: c.author,
  parentId: c.parentId,
  replyTo: c.replyTo,
  replyCount: c._count.replies,
});

/** Top-level comments of a post (oldest first), or the replies of one comment when `parentId` is given. */
export async function listComments(
  postId: string,
  parentId: string | undefined,
  cursor: string | undefined,
  limit: number,
): Promise<Paginated<Comment>> {
  const rows = await prisma.comment.findMany({
    where: { postId, parentId: parentId ?? null },
    include: commentInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  return { items: items.map(toComment), nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

/**
 * Adds a comment, or a reply when `parentId` is given. Threads are one level deep:
 * replying to a reply attaches to the same top-level comment and records who was answered.
 */
export async function addComment(userId: string, postId: string, content: string, parentId?: string): Promise<Comment> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) throw notFound("Post");

  let threadId: string | null = null;
  let replyToId: string | null = null;
  if (parentId) {
    const target = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { postId: true, parentId: true, authorId: true },
    });
    if (!target || target.postId !== postId) throw notFound("Comment");
    threadId = target.parentId ?? parentId;
    replyToId = target.authorId;
  }

  const c = await prisma.comment.create({
    data: { postId, authorId: userId, content, parentId: threadId, replyToId },
    include: commentInclude,
  });

  if (replyToId) await notify({ recipientId: replyToId, actorId: userId, type: "REPLY", postId, commentId: c.id });
  // The post author hears about every comment, unless they were already notified as the person replied to.
  if (post.authorId !== replyToId) {
    await notify({ recipientId: post.authorId, actorId: userId, type: "COMMENT", postId, commentId: c.id });
  }
  return toComment(c);
}

export async function deleteComment(userId: string, commentId: string) {
  const c = await prisma.comment.findUnique({ where: { id: commentId }, include: { post: { select: { authorId: true } } } });
  if (!c) throw notFound("Comment");
  // Comment authors and the post's author can delete a comment.
  if (c.authorId !== userId && c.post.authorId !== userId) throw forbidden();
  await prisma.comment.delete({ where: { id: commentId } });
}
