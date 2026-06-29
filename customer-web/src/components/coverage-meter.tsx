"use client";

import { motion } from "motion/react";
import { Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverageMeterProps {
  servings: number;
  headcount: number;
  showHeader?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Segmented "Serves 6-8" coverage bar that fills with the sunset gradient
 *  and snaps to success-green when the headcount is fully covered. */
export function CoverageMeter({
  servings,
  headcount,
  showHeader = true,
  size = "md",
  className,
}: CoverageMeterProps) {
  const ratio = headcount > 0 ? servings / headcount : 0;
  const covered = ratio >= 1;
  const pct = Math.max(0, Math.min(ratio, 1)) * 100;
  const segMask =
    "repeating-linear-gradient(90deg,#000 0 16px, transparent 16px 19px)";

  return (
    <div className={cn("w-full", className)}>
      {showHeader && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Feeds ~{Math.round(servings)} of {headcount}
          </span>
          <span className={cn("tnum flex items-center gap-1", covered ? "text-success" : "text-primary")}>
            {covered ? (
              <>
                <Check className="h-3.5 w-3.5" /> Fully covered
              </>
            ) : (
              `${Math.round(pct)}%`
            )}
          </span>
        </div>
      )}
      <div className={cn("relative w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-2" : "h-3")}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className={cn("h-full rounded-full", covered ? "bg-success" : "bg-sunset")}
          style={{ maskImage: segMask, WebkitMaskImage: segMask }}
        />
      </div>
    </div>
  );
}
