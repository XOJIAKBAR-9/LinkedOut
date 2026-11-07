import type { Comment, Paginated, Post, ReactionType } from "@linkedout/shared";
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
    _count: { select: { comments: true, reactions: true } },
    reactions: { where: { userId: viewerId }, select: { type: true }, take: 1 },
  }) satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

const toPost = (p: PostRow): Post => ({
  id: p.id,
  content: p.content,
  imageUrl: p.imageUrl,
  createdAt: p.createdAt.toISOString(),
  author: p.author,
  commentCount: p._count.comments,
  reactionCount: p._count.reactions,
  myReaction: p.reactions[0]?.type ?? null,
});

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
  return { items: items.map(toPost), nextCursor: rows.length > limit ? items.at(-1)!.id : null };
}

/**
 * Posts from you and your connections. Users with no connections yet see
 * everyone's posts so the feed is never empty on day one.
 */
export async function feed(viewerId: string, cursor: string | undefined, limit: number) {
  const network = await connectedUserIds(viewerId);
  const where: Prisma.PostWhereInput =
    network.length > 0 ? { groupId: null, authorId: { in: [viewerId, ...network] } } : { groupId: null };
  return page(viewerId, where, cursor, limit);
}

export async function byAuthor(viewerId: string, authorId: string, cursor: string | undefined, limit: number) {
  return page(viewerId, { authorId, groupId: null }, cursor, limit);
}

export async function getPost(viewerId: string, postId: string): Promise<Post> {
  const p = await prisma.post.findUnique({ where: { id: postId }, include: postInclude(viewerId) });
  if (!p) throw notFound("Post");
  return toPost(p);
}

export async function create(authorId: string, content: string, image?: Express.Multer.File): Promise<Post> {
  const imageUrl = image ? (await storage.save(image.buffer, image.originalname, "posts")).url : null;
  const p = await prisma.post.create({ data: { authorId, content, imageUrl }, include: postInclude(authorId) });
  return toPost(p);
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
