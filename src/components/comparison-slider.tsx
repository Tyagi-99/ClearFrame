"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  aspectRatio?: number;
  kind?: "image" | "video";
};

export function ComparisonSlider({
  before,
  after,
  beforeLabel = "Original",
  afterLabel = "Cleaned",
  className,
  aspectRatio,
  kind = "image",
}: Props) {
  const [amount, setAmount] = useState(52);
  const track = useRef<HTMLDivElement>(null);
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;

  function setFromClientX(clientX: number) {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setAmount(Math.max(2, Math.min(98, next)));
  }

  const mediaClass = "absolute inset-0 size-full object-contain bg-black/20";

  return (
    <div
      ref={track}
      className={cn(
        "relative mx-auto overflow-hidden rounded-xl bg-muted select-none",
        className,
      )}
      style={{
        aspectRatio: String(ratio),
        width: `min(100%, calc(72vh * ${ratio}))`,
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        setFromClientX(event.clientX);
      }}
    >
      {kind === "video" ? (
        <video src={after} className={mediaClass} controls playsInline muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={after} alt={afterLabel} className={mediaClass} />
      )}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - amount}% 0 0)` }}
      >
        {kind === "video" ? (
          <video src={before} className={mediaClass} muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={before} alt={beforeLabel} className={mediaClass} />
        )}
      </div>
      <div
        className="absolute inset-y-0 z-10 w-px bg-white/80"
        style={{ left: `${amount}%` }}
      >
        <div className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-black/50" />
      </div>
      <span className="absolute top-3 left-3 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 rounded-md bg-black/55 px-2 py-1 text-[11px] text-white">
        {afterLabel}
      </span>
    </div>
  );
}
