import type { ReactionType } from "@linkedout/shared";
import { DoorOpen, Laugh, Medal, Users, type LucideIcon } from "lucide-react";

/** Themed reactions. Labels are translated via `reactions.<TYPE>`; colours meet AA in both themes. */
export const REACTION_META: Record<ReactionType, { icon: LucideIcon; className: string; activeClassName: string }> = {
  RESPECT: { icon: Medal, className: "text-primary", activeClassName: "border-primary/60 bg-accent text-accent-foreground" },
  SAME: { icon: Users, className: "text-success", activeClassName: "border-success/60 bg-success/10 text-success" },
  RUN: { icon: DoorOpen, className: "text-warning", activeClassName: "border-warning/60 bg-warning/10 text-warning" },
  FUNNY: { icon: Laugh, className: "text-foreground", activeClassName: "border-foreground/40 bg-muted text-foreground" },
};
