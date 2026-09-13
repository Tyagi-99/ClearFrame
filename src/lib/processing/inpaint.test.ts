import { describe, expect, it } from "vitest";
import { createBuffer, getPixel, setPixel } from "./buffer";
import { inpaintRect } from "./inpaint";

describe("inpaintRect", () => {
  it("fills a painted date strip using nearby pixels", () => {
    const width = 240;
    const height = 80;
    const buffer = createBuffer(width, height, [0, 0, 0, 255]);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const g = Math.round((x / (width - 1)) * 180 + 40);
        setPixel(buffer, x, y, [g, g, g, 255]);
      }
    }

    const rect = { x: 80, y: 28, width: 90, height: 18 };
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        setPixel(buffer, x, y, [255, 255, 255, 255]);
      }
    }

    const before = getPixel(buffer, 125, 37);
    expect(before[0]).toBe(255);

    inpaintRect(buffer, rect);

    const after = getPixel(buffer, 125, 37);
    expect(after[0]).toBeLessThan(200);
    expect(after[0]).toBeGreaterThan(80);
    expect(Math.abs(after[0] - after[1])).toBeLessThanOrEqual(4);
  });

  it("keeps a smooth edge instead of a hard erased rectangle", () => {
    const width = 160;
    const height = 80;
    const buffer = createBuffer(width, height, [90, 110, 70, 255]);
    const rect = { x: 40, y: 20, width: 60, height: 40 };
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        setPixel(buffer, x, y, [255, 0, 0, 255]);
      }
    }

    inpaintRect(buffer, rect);

    const outside = getPixel(buffer, 38, 40);
    const nearEdge = getPixel(buffer, 48, 40);
    const center = getPixel(buffer, 70, 40);
    expect(outside[0]).toBe(90);
    expect(center[0]).toBeLessThan(160);
    expect(center[1]).toBeGreaterThan(40);
    expect(Math.abs(nearEdge[0] - outside[0])).toBeLessThan(Math.abs(255 - 90));
  });
});
