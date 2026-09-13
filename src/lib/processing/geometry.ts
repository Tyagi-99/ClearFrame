import type { NormalizedRegion, PixelBox, PixelRect } from "./types";

export const REFERENCE = { size: 48, inset: 73 } as const;
export const VIDEO_SCALE_HEIGHT = 720;

export function defaultBox(width: number, height: number, maskScale = 1): PixelBox {
  const size = Math.max(8, Math.round(REFERENCE.size * maskScale));
  const grow = Math.round((size - REFERENCE.size) / 2);
  return {
    x: Math.max(0, Math.min(width - size, width - REFERENCE.inset - size + grow)),
    y: Math.max(0, Math.min(height - size, height - REFERENCE.inset - size + grow)),
    size,
  };
}

export function seedSizes(width: number, height: number): number[] {
  const minSide = Math.min(width, height);
  const sizes: number[] = [REFERENCE.size];
  const scaled = Math.round(REFERENCE.size * (minSide / VIDEO_SCALE_HEIGHT));
  if (scaled >= REFERENCE.size + 6 && scaled <= minSide / 3) sizes.push(scaled);
  return sizes;
}

export function anchorBoxes(width: number, height: number): PixelBox[] {
  const out = [defaultBox(width, height, 1)];
  for (const size of seedSizes(width, height)) {
    const inset = 2 * size;
    const x = width - inset - size;
    const y = height - inset - size;
    if (x >= 0 && y >= 0) out.push({ x, y, size });
  }
  return out;
}

export function boxToNormalized(
  box: PixelBox,
  width: number,
  height: number,
): NormalizedRegion {
  return {
    x: box.x / width,
    y: box.y / height,
    width: box.size / width,
    height: box.size / height,
  };
}

export function normalizedToBox(
  region: NormalizedRegion,
  width: number,
  height: number,
): PixelBox {
  const size = Math.max(
    8,
    Math.round(((region.width * width) + (region.height * height)) / 2),
  );
  return {
    x: Math.max(0, Math.min(width - size, Math.round(region.x * width))),
    y: Math.max(0, Math.min(height - size, Math.round(region.y * height))),
    size,
  };
}

export function clampBox(box: PixelBox, width: number, height: number): PixelBox {
  const size = Math.max(8, Math.min(box.size, width, height));
  return {
    x: Math.max(0, Math.min(width - size, Math.round(box.x))),
    y: Math.max(0, Math.min(height - size, Math.round(box.y))),
    size,
  };
}

export function defaultOtherRegion(): NormalizedRegion {
  return { x: 0.72, y: 0.88, width: 0.24, height: 0.08 };
}

export function normalizedToRect(
  region: NormalizedRegion,
  width: number,
  height: number,
): PixelRect {
  const w = Math.max(8, Math.round(region.width * width));
  const h = Math.max(8, Math.round(region.height * height));
  return {
    x: Math.max(0, Math.min(width - w, Math.round(region.x * width))),
    y: Math.max(0, Math.min(height - h, Math.round(region.y * height))),
    width: Math.min(w, width),
    height: Math.min(h, height),
  };
}

export function rectToNormalized(
  rect: PixelRect,
  width: number,
  height: number,
): NormalizedRegion {
  return {
    x: rect.x / width,
    y: rect.y / height,
    width: rect.width / width,
    height: rect.height / height,
  };
}
