"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const FALLBACKS = ["bg-sunset", "bg-grape", "bg-sunset-soft", "bg-conic-sunset"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

interface FoodImageProps {
  src?: string;
  alt: string;
  emoji?: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

/** next/image with an on-brand gradient + emoji fallback if the photo fails. */
export function FoodImage({ src, alt, emoji = "🍽️", sizes, className, priority }: FoodImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored || !src) {
    const grad = FALLBACKS[hash(alt) % FALLBACKS.length];
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center", grad, className)}>
        <span className="text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]">{emoji}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes ?? "(max-width: 768px) 100vw, 33vw"}
      onError={() => setErrored(true)}
      className={cn("object-cover", className)}
    />
  );
}
