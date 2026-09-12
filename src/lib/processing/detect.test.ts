import { describe, expect, it } from "vitest";
import { createBuffer, getPixel, setPixel } from "./buffer";
import { detectWatermark } from "./detect";
import { defaultBox } from "./geometry";
import { geminiMask } from "./mask";
import { compositePixel } from "./reconstruct";

describe("watermark detection", () => {
  it("finds a composited Gemini sparkle near the reference corner", () => {
    const width = 320;
    const height = 240;
    const buffer = createBuffer(width, height, [30, 40, 50, 255]);
    const mask = geminiMask();
    const box = defaultBox(width, height);
    for (let y = 0; y < mask.size; y += 1) {
      for (let x = 0; x < mask.size; x += 1) {
        const alpha = mask.data[y * mask.size + x];
        if (alpha <= 0) continue;
        const px = getPixel(buffer, box.x + x, box.y + y);
        setPixel(buffer, box.x + x, box.y + y, [
          compositePixel(px[0], 255, alpha),
          compositePixel(px[1], 255, alpha),
          compositePixel(px[2], 255, alpha),
          255,
        ]);
      }
    }

    const result = detectWatermark(buffer);
    expect(result.detected).toBe(true);
    expect(Math.abs(result.box.x - box.x)).toBeLessThanOrEqual(8);
    expect(Math.abs(result.box.y - box.y)).toBeLessThanOrEqual(8);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
