import { z } from "zod";
import type { PublicUser } from "./user.js";

export const REACTION_TYPES = ["LIKE", "CELEBRATE", "SUPPORT", "INSIGHTFUL", "FUNNY"] as const;
export const reactionTypeSchema = z.enum(REACTION_TYPES);
export type ReactionType = z.infer<typeof reactionTypeSchema>;

export const createPostSchema = z.object({
  content: z.string().trim().min(1, "validation.postEmpty").max(3000, "validation.tooLong"),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, "validation.commentEmpty").max(1250, "validation.tooLong"),
  /** Reply to this comment. Replies to a reply join the same thread under its top-level comment. */
  parentId: z.string().min(1).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const reactSchema = z.object({ type: reactionTypeSchema });

export interface Post {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author: PublicUser;
  commentCount: number;
  reactionCount: number;
  myReaction: ReactionType | null;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: PublicUser;
  /** Top-level comment id for replies; null for top-level comments. */
  parentId: string | null;
  /** Author of the comment this replies to (shown as "@Name"), when it's a reply. */
  replyTo: PublicUser | null;
  /** Number of replies (top-level comments only; 0 for replies). */
  replyCount: number;
}

export const listCommentsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Omit for top-level comments; pass a comment id to list its replies. */
  parentId: z.string().min(1).optional(),
});
export type ListCommentsInput = z.infer<typeof listCommentsSchema>;
