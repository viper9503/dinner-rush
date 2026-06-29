import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-[#ffd9a8] hover:shadow-lift",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
