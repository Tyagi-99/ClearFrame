"use client";

import { useRef } from "react";
import type { NormalizedRegion } from "@/lib/processing/types";

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN = 0.03;

function clampRegion(region: NormalizedRegion): NormalizedRegion {
  const width = Math.max(MIN, Math.min(1, region.width));
  const height = Math.max(MIN, Math.min(1, region.height));
  return {
    x: Math.max(0, Math.min(1 - width, region.x)),
    y: Math.max(0, Math.min(1 - height, region.y)),
    width,
    height,
  };
}

export function RegionEditor({
  children,
  region,
  onChange,
}: {
  children: React.ReactNode;
  region: NormalizedRegion;
  onChange: (region: NormalizedRegion) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  function start(handle: Handle, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const originX = event.clientX;
    const originY = event.clientY;
    const startRegion = { ...region };

    const move = (next: PointerEvent) => {
      const dx = (next.clientX - originX) / bounds.width;
      const dy = (next.clientY - originY) / bounds.height;
      const nextRegion = { ...startRegion };
      if (handle === "move") {
        nextRegion.x = startRegion.x + dx;
        nextRegion.y = startRegion.y + dy;
      } else {
        if (handle.includes("w")) {
          nextRegion.x = startRegion.x + dx;
          nextRegion.width = startRegion.width - dx;
        }
        if (handle.includes("e")) nextRegion.width = startRegion.width + dx;
        if (handle.includes("n")) {
          nextRegion.y = startRegion.y + dy;
          nextRegion.height = startRegion.height - dy;
        }
        if (handle.includes("s")) nextRegion.height = startRegion.height + dy;
      }
      onChange(clampRegion(nextRegion));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const handleClass =
    "absolute z-20 size-3 rounded-sm border border-white bg-signal";

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-xl bg-muted">
      {children}
      <div
        className="absolute z-10 cursor-move border-2 border-signal bg-signal/10"
        style={{
          left: `${region.x * 100}%`,
          top: `${region.y * 100}%`,
          width: `${region.width * 100}%`,
          height: `${region.height * 100}%`,
        }}
        onPointerDown={(event) => start("move", event)}
      >
        <span
          className={`${handleClass} -top-1.5 -left-1.5 cursor-nwse-resize`}
          onPointerDown={(event) => start("nw", event)}
        />
        <span
          className={`${handleClass} -top-1.5 -right-1.5 cursor-nesw-resize`}
          onPointerDown={(event) => start("ne", event)}
        />
        <span
          className={`${handleClass} -bottom-1.5 -left-1.5 cursor-nesw-resize`}
          onPointerDown={(event) => start("sw", event)}
        />
        <span
          className={`${handleClass} -bottom-1.5 -right-1.5 cursor-nwse-resize`}
          onPointerDown={(event) => start("se", event)}
        />
      </div>
    </div>
  );
}
