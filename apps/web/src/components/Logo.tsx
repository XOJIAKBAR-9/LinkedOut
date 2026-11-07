import { useId } from "react";
import { cn } from "@/lib/utils";

/** Brand mark: an "l" and an "o" with an arrow heading out — LinkedOut. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.55" stopColor="#0d9488" />
          <stop offset="1" stopColor="#0e7490" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x="7" y="7" width="3.6" height="18" rx="1.8" fill="#fff" />
      <circle cx="18.5" cy="19.5" r="5" fill="none" stroke="#fff" strokeWidth="3.4" />
      <path d="M21.5 12.5 L26 8 M22 8 H26 V12" fill="none" stroke="#fde68a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="text-xl font-extrabold tracking-tight">
          Linked<span className="bg-gradient-to-r from-teal-400 to-cyan-500 bg-clip-text text-transparent">Out</span>
        </span>
      )}
    </span>
  );
}
