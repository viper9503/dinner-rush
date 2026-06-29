import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-[0.02em] leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        serves: "bg-muted text-primary ring-1 ring-inset ring-border",
        multi: "text-white bg-grape shadow-[0_4px_12px_-4px_rgba(214,38,110,0.5)]",
        deal: "bg-accent text-accent-ink",
        new: "bg-accent-alt text-white",
        popular: "bg-[#fff2d1] text-[#8a5a07]",
        dietary: "bg-white text-success ring-1 ring-inset ring-success/25",
        limited: "bg-[#ffe6dd] text-[#c2401e]",
        neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
        glass: "glass text-foreground",
        sunset: "bg-sunset text-white",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.625rem]",
        md: "px-2.5 py-1 text-[0.6875rem]",
        lg: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
