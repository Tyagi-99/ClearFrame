"use client";

import { useEffect, useState } from "react";
import { ComparisonSlider } from "@/components/comparison-slider";
import { defaultBox } from "@/lib/processing/geometry";
import { geminiMask } from "@/lib/processing/mask";
import { compositePixel } from "@/lib/processing/reconstruct";

export function ComparisonDemo() {
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);

  useEffect(() => {
    const revoked: string[] = [];
    const image = new Image();
    image.src = "/demo/hero-frame.jpg";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const afterUrl = canvas.toDataURL("image/jpeg", 0.92);
      setAfter(afterUrl);

      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = geminiMask();
      const box = defaultBox(canvas.width, canvas.height);
      for (let y = 0; y < mask.size; y += 1) {
        for (let x = 0; x < mask.size; x += 1) {
          const alpha = mask.data[y * mask.size + x];
          if (alpha <= 0) continue;
          const p = ((box.y + y) * canvas.width + (box.x + x)) * 4;
          pixels.data[p] = compositePixel(pixels.data[p], 255, alpha);
          pixels.data[p + 1] = compositePixel(pixels.data[p + 1], 255, alpha);
          pixels.data[p + 2] = compositePixel(pixels.data[p + 2], 255, alpha);
        }
      }
      ctx.putImageData(pixels, 0, 0);
      const beforeUrl = canvas.toDataURL("image/jpeg", 0.92);
      setBefore(beforeUrl);
    };
    return () => {
      revoked.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (!before || !after) {
    return (
      <div className="aspect-video w-full rounded-xl bg-muted" aria-hidden />
    );
  }

  return (
    <ComparisonSlider
      before={before}
      after={after}
      beforeLabel="Visible overlay"
      afterLabel="Cleaned"
    />
  );
}
