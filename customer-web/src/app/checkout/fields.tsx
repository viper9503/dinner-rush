"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "h-12 w-full rounded-[1rem] border border-border bg-white px-4 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary-bright focus:outline-none focus:ring-4 focus:ring-primary-bright/10";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-baseline justify-between text-[0.8125rem] font-semibold text-foreground">
        {label}
        {hint && <span className="text-[0.6875rem] font-medium text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, className)} {...props} />
));
TextInput.displayName = "TextInput";

export function SelectInput({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(fieldBase, "cursor-pointer appearance-none pr-10", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </div>
  );
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[1rem] border border-border bg-white px-4 py-3 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/70 transition focus:border-primary-bright focus:outline-none focus:ring-4 focus:ring-primary-bright/10",
        className,
      )}
      {...props}
    />
  );
}

/** A pill-style toggle switch (controlled). */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-[1rem] border bg-white p-3.5 text-left transition",
        checked ? "border-primary bg-muted/60 ring-2 ring-primary/15" : "border-border hover:border-primary/40",
      )}
    >
      {Icon && (
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full transition",
            checked ? "bg-primary text-white" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}
