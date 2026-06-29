import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8", className)}>{children}</div>;
}

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block text-xs font-bold uppercase tracking-[0.12em] text-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className={cn("max-w-2xl text-[1.0625rem] leading-relaxed text-muted-foreground", align === "center" && "mx-auto")}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Scalloped warm-cream divider, like layered butcher paper. */
export function ScallopDivider({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("h-4 w-full bg-background", className)}
      style={{
        maskImage: "radial-gradient(14px at 14px 0, transparent 0 13px, #000 13px)",
        WebkitMaskImage: "radial-gradient(14px at 14px 0, transparent 0 13px, #000 13px)",
        maskSize: "28px 16px",
        WebkitMaskSize: "28px 16px",
        maskRepeat: "repeat-x",
        WebkitMaskRepeat: "repeat-x",
        transform: flip ? "scaleY(-1)" : undefined,
      }}
    />
  );
}
