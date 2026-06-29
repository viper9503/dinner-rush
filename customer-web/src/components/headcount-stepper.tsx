"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, Users } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

interface HeadcountStepperProps {
  size?: "sm" | "md";
  step?: number;
  showIcon?: boolean;
  className?: string;
}

/** Global headcount control (writes straight to the cart). */
export function HeadcountStepper({
  size = "md",
  step = 5,
  showIcon = true,
  className,
}: HeadcountStepperProps) {
  const { headcount, bumpHeadcount } = useCart();
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const btn =
    "grid place-items-center rounded-full bg-white border border-border shadow-sm transition hover:border-primary hover:text-primary text-foreground";

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-muted p-1", className)}>
      <button type="button" aria-label="Fewer guests" onClick={() => bumpHeadcount(-step)} className={cn(btn, dim)}>
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex min-w-[68px] items-center justify-center gap-1.5 px-1">
        {showIcon && <Users className="h-4 w-4 text-primary" />}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={headcount}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="tnum text-sm font-bold text-foreground"
          >
            {headcount}
          </motion.span>
        </AnimatePresence>
      </div>
      <button type="button" aria-label="More guests" onClick={() => bumpHeadcount(step)} className={cn(btn, dim)}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
