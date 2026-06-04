import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/30",
        ok:      "bg-[oklch(0.73_0.20_148)]/10 text-[oklch(0.73_0.20_148)] border border-[oklch(0.73_0.20_148)]/25",
        warn:    "bg-[oklch(0.85_0.17_84)]/10 text-[oklch(0.85_0.17_84)] border border-[oklch(0.85_0.17_84)]/25",
        overdue: "bg-destructive/10 text-destructive border border-destructive/25",
        outline: "border border-border text-foreground",
        secondary: "bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
