import { describe, expect, it } from "vitest";
import { createBuffer, setPixel, getPixel } from "./buffer";
import { geminiMask } from "./mask";
import {
  compositePixel,
  invertComposite,
  unblendRegion,
  DEFAULT_RECONSTRUCTION,
} from "./reconstruct";
import { boxToNormalized, defaultBox, normalizedToBox } from "./geometry";

describe("inverse compositing", () => {
  it("recovers the original channel from a known alpha blend", () => {
    const original = 100;
    const overlay = 255;
    const alpha = 0.5;
    const observed = compositePixel(original, overlay, alpha);
    expect(observed).toBeCloseTo(177.5, 5);
    expect(invertComposite(observed, overlay, alpha)).toBeCloseTo(original, 5);
  });

  it("leaves fully transparent pixels unchanged", () => {
    expect(invertComposite(42, 255, 0)).toBe(42);
  });

  it("clamps numerically unstable near-opaque pixels", () => {
    const recovered = invertComposite(250, 255, 0.99);
    expect(Number.isFinite(recovered)).toBe(true);
    expect(recovered).toBeGreaterThanOrEqual(0);
    expect(recovered).toBeLessThanOrEqual(255);
  });

  it("restores a synthetic Gemini overlay from a flat field", () => {
    const width = 200;
    const height = 200;
    const original = createBuffer(width, height, [40, 80, 120, 255]);
    const observed = createBuffer(width, height, [40, 80, 120, 255]);
    const mask = geminiMask();
    const box = { x: 140, y: 140, size: mask.size };

    for (let y = 0; y < mask.size; y += 1) {
      for (let x = 0; x < mask.size; x += 1) {
        const alpha = mask.data[y * mask.size + x];
        if (alpha <= 0) continue;
        const px = getPixel(original, box.x + x, box.y + y);
        setPixel(observed, box.x + x, box.y + y, [
          compositePixel(px[0], 255, alpha),
          compositePixel(px[1], 255, alpha),
          compositePixel(px[2], 255, alpha),
          255,
        ]);
      }
    }

    const stats = unblendRegion(observed, box, mask, {
      ...DEFAULT_RECONSTRUCTION,
      opacity: 1,
    });

    const sample = getPixel(observed, box.x + 24, box.y + 24);
    expect(Math.abs(sample[0] - 40)).toBeLessThanOrEqual(2);
    expect(Math.abs(sample[1] - 80)).toBeLessThanOrEqual(2);
    expect(Math.abs(sample[2] - 120)).toBeLessThanOrEqual(2);
    expect(stats.quality).toBeGreaterThan(0.9);
    expect(stats.touched).toBeGreaterThan(100);
  });
});

describe("geometry", () => {
  it("places the still-image reference box at the measured inset", () => {
    const box = defaultBox(768, 1376);
    expect(box.size).toBe(48);
    expect(box.x).toBe(647);
    expect(box.y).toBe(1255);
  });

  it("round-trips normalized regions", () => {
    const box = { x: 1136, y: 576, size: 48 };
    const region = boxToNormalized(box, 1280, 720);
    expect(region.x).toBeCloseTo(1136 / 1280, 5);
    expect(region.y).toBeCloseTo(576 / 720, 5);
    expect(normalizedToBox(region, 1280, 720)).toEqual(box);
  });
});
