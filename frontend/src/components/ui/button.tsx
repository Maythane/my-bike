import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold transition-all duration-[220ms] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.94] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        secondary:
          "bg-white/[0.08] text-foreground border border-white/[0.13] backdrop-blur-sm hover:bg-white/[0.12]",
        ghost:
          "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
        destructive:
          "bg-destructive/70 text-white border border-destructive/30 backdrop-blur-sm hover:bg-destructive/80",
        outline:
          "border border-border bg-transparent hover:bg-muted text-foreground",
        jelly:
          "bg-emerald-600/75 text-emerald-50 border border-emerald-400/40 backdrop-blur-sm hover:bg-emerald-600/85",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-7 px-3.5 py-1.5 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
