import type { PostType } from "@linkedout/shared";
import { Ban, DoorOpen, Flag, MessageSquareText, type LucideIcon } from "lucide-react";

/**
 * Visual treatment per post type (labels via `postTypes.<TYPE>.*`):
 * - QUIT: red-pen stamp, serif headline, company struck through
 * - WARNING: highlighter band — "don't apply here"
 * - RED_FLAG: redline bar on the left with a flag
 */
export const POST_TYPE_META: Record<
  PostType,
  { icon: LucideIcon; stamp: "stamp" | "stamp-warning" | "stamp-muted"; card: string; chip: string }
> = {
  UPDATE: { icon: MessageSquareText, stamp: "stamp-muted", card: "", chip: "data-[active=true]:border-foreground/50 data-[active=true]:bg-muted" },
  QUIT: {
    icon: DoorOpen,
    stamp: "stamp",
    card: "",
    chip: "data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
  },
  WARNING: {
    icon: Ban,
    stamp: "stamp-warning",
    card: "border-t-4 border-t-highlight",
    chip: "data-[active=true]:border-warning data-[active=true]:bg-warning/10 data-[active=true]:text-warning",
  },
  RED_FLAG: {
    icon: Flag,
    stamp: "stamp",
    card: "border-l-4 border-l-primary",
    chip: "data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
  },
};
