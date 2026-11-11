import { cn } from "@/lib/utils";

/** Brand mark: "lo" on an ink tile, with a redline arrow walking out of the "o". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="6" className="fill-foreground" />
      <rect x="7" y="7" width="3.6" height="18" rx="1.2" className="fill-background" />
      <circle cx="18.5" cy="19.5" r="5" fill="none" strokeWidth="3.4" className="stroke-background" />
      <path d="M21.5 12.5 L26.5 7.5 M22.3 7.5 H26.5 V11.7" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="font-display text-xl font-semibold tracking-tight">
          Linked<span className="italic text-primary">Out</span>
        </span>
      )}
    </span>
  );
}
