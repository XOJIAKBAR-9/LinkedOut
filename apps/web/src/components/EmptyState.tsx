import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Empty and end states with some personality: an icon, a serif headline,
 * one line of copy and an optional action. Never just "nothing here".
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-full border border-border text-muted-foreground" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <p className="max-w-sm font-display text-xl italic leading-snug">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
