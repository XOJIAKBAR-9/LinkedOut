import type { ReactionType } from "@linkedout/shared";

/** Labels are translated via `reactions.<TYPE>`. */
export const REACTION_META: Record<ReactionType, { emoji: string; className: string }> = {
  LIKE: { emoji: "👍", className: "text-blue-600 dark:text-blue-400" },
  CELEBRATE: { emoji: "👏", className: "text-green-600 dark:text-green-400" },
  SUPPORT: { emoji: "💜", className: "text-purple-600 dark:text-purple-400" },
  INSIGHTFUL: { emoji: "💡", className: "text-amber-600 dark:text-amber-400" },
  FUNNY: { emoji: "😄", className: "text-sky-600 dark:text-sky-400" },
};
