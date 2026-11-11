import { z } from "zod";
import type { PublicUser } from "./user.js";

/** Themed reactions — the anti-"Like". */
export const REACTION_TYPES = ["RESPECT", "SAME", "RUN", "FUNNY"] as const;
export const reactionTypeSchema = z.enum(REACTION_TYPES);
export type ReactionType = z.infer<typeof reactionTypeSchema>;

/** Plain update, "I quit" story, "Don't apply here" warning, interview "Red flag". */
export const POST_TYPES = ["UPDATE", "QUIT", "WARNING", "RED_FLAG"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Reason tags for quit stories and warnings. Labels are translated (`reasons.<id>`). */
export const QUIT_REASONS = [
  "burnout",
  "unpaid_overtime",
  "toxic_boss",
  "low_pay",
  "no_growth",
  "micromanagement",
  "broken_promises",
  "layoffs",
  "return_to_office",
  "discrimination",
  "chaos",
  "other",
] as const;
export type QuitReason = (typeof QUIT_REASONS)[number];
export const MAX_REASONS = 4;

/** Multipart forms send everything as strings: accept JSON arrays, comma lists and "true"/"false". */
const stringList = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* not JSON: fall through to comma list */
  }
  return v.split(",").map((x) => x.trim()).filter(Boolean);
}, z.array(z.enum(QUIT_REASONS)).max(MAX_REASONS, "validation.tooManyReasons"));

const boolish = z.preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean());
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max, "validation.tooLong").optional());

export const createPostSchema = z
  .object({
    type: z.enum(POST_TYPES).default("UPDATE"),
    headline: optionalText(140),
    content: z.string().trim().min(1, "validation.postEmpty").max(3000, "validation.tooLong"),
    companyName: optionalText(100),
    role: optionalText(100),
    tenureMonths: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
      z.number().int().min(0).max(600).optional(),
    ),
    reasons: stringList.default([]),
    anonymous: boolish.default(false),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "UPDATE" && !v.companyName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["companyName"], message: "validation.companyRequired" });
    }
  })
  // Plain updates don't carry exit-record fields.
  .transform((v) =>
    v.type === "UPDATE" ? { ...v, companyName: undefined, role: undefined, tenureMonths: undefined, reasons: [] } : v,
  );
export type CreatePostInput = z.input<typeof createPostSchema>;
export type CreatePostData = z.output<typeof createPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, "validation.commentEmpty").max(1250, "validation.tooLong"),
  /** Reply to this comment. Replies to a reply join the same thread under its top-level comment. */
  parentId: z.string().min(1).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const reactSchema = z.object({ type: reactionTypeSchema });

export interface Post {
  id: string;
  type: PostType;
  headline: string | null;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  /** Null when the post is anonymous and you're not its author. */
  author: PublicUser | null;
  anonymous: boolean;
  /** True for your own posts (including anonymous ones). */
  isMine: boolean;
  companyName: string | null;
  company: { id: string; name: string; slug: string } | null;
  role: string | null;
  tenureMonths: number | null;
  reasons: QuitReason[];
  commentCount: number;
  reactionCount: number;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
}

/** Sidebar data for the feed. */
export interface FeedInsights {
  /** Companies with the most "Don't apply here" + "Red flag" posts in the last 7 days. */
  mostWarned: { name: string; slug: string | null; count: number }[];
  /** Most-used reasons on quit stories in the last 30 days. */
  trendingReasons: { reason: QuitReason; count: number }[];
  /** Your own quit history (anonymous posts included — only you see this). */
  me: { lastQuitAt: string | null; lastQuitCompany: string | null; quitCount: number };
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
