import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_rgba(232,67,31,0.5)] hover:bg-primary-bright hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-8px_rgba(232,67,31,0.55)] focus-visible:ring-primary-bright/40",
        hero:
          "bg-sunset text-white shadow-[0_12px_32px_-8px_rgba(232,67,31,0.6)] hover:saturate-[1.08] hover:brightness-[1.03] hover:-translate-y-0.5 focus-visible:ring-primary-bright/40",
        juicy:
          "bg-accent text-accent-ink shadow-[0_8px_20px_-6px_rgba(255,176,32,0.6)] hover:bg-[#ffa600] hover:-translate-y-0.5 focus-visible:ring-accent/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[#5b21bd] hover:-translate-y-0.5 focus-visible:ring-secondary/40",
        outline:
          "border-2 border-border bg-surface text-foreground hover:border-primary hover:text-primary hover:bg-muted focus-visible:ring-primary/30",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        white:
          "bg-white text-foreground shadow-soft hover:-translate-y-0.5 focus-visible:ring-white/60",
      },
      size: {
        sm: "px-4 py-2 text-[0.8125rem]",
        md: "px-6 py-3 text-[0.9375rem]",
        lg: "px-8 py-4 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
