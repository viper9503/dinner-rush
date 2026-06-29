"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, Minus, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { Button, type ButtonProps } from "./ui/button";
import { cn } from "@/lib/utils";

const CONFETTI = ["🍅", "🍋", "🥬", "🌶️", "🧀", "🥑"];

export function AddToBundle({
  dishId,
  variant = "juicy",
  size = "md",
  label = "Add to bundle",
  className,
}: {
  dishId: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  label?: string;
  className?: string;
}) {
  const { qtyOf, add, decrement } = useCart();
  const qty = qtyOf(dishId);
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState(0);

  const handleAdd = () => {
    add(dishId);
    setBurst((b) => b + 1);
  };

  return (
    <div className={cn("relative", className)}>
      {!reduce && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <AnimatePresence>
            {burst > 0 &&
              CONFETTI.map((c, i) => (
                <motion.span
                  key={`${burst}-${i}`}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 0, x: (i - 2.5) * 28, y: -44 - (i % 3) * 14, scale: 1.15, rotate: (i - 2.5) * 38 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="absolute text-base"
                >
                  {c}
                </motion.span>
              ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {qty === 0 ? (
          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <Button variant={variant} size={size} className="w-full" onClick={handleAdd}>
              <Plus className="h-4 w-4" /> {label}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="stepper"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-between gap-2 rounded-full bg-muted p-1.5"
          >
            <button
              type="button"
              aria-label="Remove one"
              onClick={() => decrement(dishId)}
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white text-foreground shadow-sm transition hover:border-primary hover:text-primary"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="tnum flex items-center gap-1.5 text-sm font-bold text-success">
              <Check className="h-4 w-4" /> {qty} in bundle
            </span>
            <button
              type="button"
              aria-label="Add one"
              onClick={handleAdd}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-bright"
            >
              <Plus className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AddBundleButton({
  bundleId,
  label = "Add bundle",
  variant = "primary",
  size = "sm",
  className,
}: {
  bundleId: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const { addBundle } = useCart();
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("relative z-10", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addBundle(bundleId);
      }}
    >
      <Plus className="h-4 w-4" /> {label}
    </Button>
  );
}
