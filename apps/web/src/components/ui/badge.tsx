import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small labels. `stamp` is the rubber-stamp look used for post types ("I QUIT")
 * and statuses; the rest are quiet chips for tags and counts.
 */
const badgeVariants = cva("inline-flex max-w-full items-center gap-1 whitespace-normal [&_svg]:size-3.5 [&_svg]:shrink-0", {
  variants: {
    variant: {
      neutral: "rounded-md bg-muted px-2 py-0.5 text-xs text-foreground",
      outline: "rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground",
      highlight: "highlighter rounded-[2px] py-0.5 text-xs font-medium",
      success: "rounded-md border border-success/40 px-2 py-0.5 text-xs text-success",
      stamp: "stamp border-primary text-primary",
      "stamp-warning": "stamp border-warning text-warning",
      "stamp-muted": "stamp border-muted-foreground text-muted-foreground",
    },
    tilt: { true: "-rotate-2", false: "" },
  },
  defaultVariants: { variant: "neutral", tilt: false },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, tilt, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, tilt }), className)} {...props} />;
}
