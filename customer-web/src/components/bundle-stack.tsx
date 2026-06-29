import { restaurantMap } from "@/lib/data";
import { cn } from "@/lib/utils";

interface BundleStackProps {
  restaurantIds: string[];
  max?: number;
  size?: "sm" | "md";
  showChip?: boolean;
  className?: string;
}

/** Overlapping restaurant avatars + "N restaurants" chip — the multi-restaurant signal. */
export function BundleStack({
  restaurantIds,
  max = 4,
  size = "md",
  showChip = true,
  className,
}: BundleStackProps) {
  const ids = restaurantIds.filter((id) => restaurantMap[id]);
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  const dim = size === "sm" ? "h-7 w-7 text-[0.65rem]" : "h-9 w-9 text-xs";

  if (ids.length === 0) return null;

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center">
        {shown.map((id, i) => {
          const r = restaurantMap[id];
          return (
            <span
              key={id}
              title={r.name}
              style={{ backgroundColor: r.logoColor, zIndex: shown.length - i }}
              className={cn(
                "grid place-items-center rounded-full font-bold text-white ring-2 ring-white shadow-sm",
                dim,
                i > 0 && "-ml-3",
              )}
            >
              {r.name.charAt(0)}
            </span>
          );
        })}
        {extra > 0 && (
          <span className={cn("z-0 -ml-3 grid place-items-center rounded-full bg-foreground font-bold text-white ring-2 ring-white", dim)}>
            +{extra}
          </span>
        )}
      </div>
      {showChip && ids.length > 1 && (
        <span className="ml-2 rounded-full bg-grape px-2.5 py-1 text-[0.6875rem] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(214,38,110,0.5)]">
          {ids.length} restaurants
        </span>
      )}
    </div>
  );
}
