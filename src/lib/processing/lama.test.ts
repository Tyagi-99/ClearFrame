import { describe, expect, it } from "vitest";
import { createBuffer, getPixel, setPixel } from "./buffer";
import {
  COMPOSITE_FEATHER_PX,
  LAMA_INPUT_SIZE,
  ROI_EXPAND,
  buildMaskTensor,
  compositeLamaOutput,
  expandRect,
  inpaintWithLama,
  prepareLamaInputs,
} from "./lama";

describe("expandRect", () => {
  it("grows a hole by the context pad while staying inside the image", () => {
    const hole = { x: 40, y: 40, width: 40, height: 20 };
    const expanded = expandRect(hole, 200, 120, ROI_EXPAND);
    expect(expanded.width).toBeGreaterThanOrEqual(Math.round(40 * (1 + ROI_EXPAND * 0.8)));
    expect(expanded.width).toBeLessThanOrEqual(Math.round(40 * (1 + ROI_EXPAND * 1.2)));
    expect(expanded.height).toBeGreaterThanOrEqual(Math.round(20 * (1 + ROI_EXPAND * 0.8)));
    expect(expanded.height).toBeLessThanOrEqual(Math.round(20 * (1 + ROI_EXPAND * 1.2)));
    expect(expanded.x).toBeGreaterThanOrEqual(0);
    expect(expanded.y).toBeGreaterThanOrEqual(0);
    expect(expanded.x + expanded.width).toBeLessThanOrEqual(200);
    expect(expanded.y + expanded.height).toBeLessThanOrEqual(120);
    expect(expanded.x).toBeLessThan(hole.x);
    expect(expanded.y).toBeLessThan(hole.y);
  });

  it("clamps against the image edge instead of overflowing", () => {
    const hole = { x: 180, y: 100, width: 20, height: 20 };
    const expanded = expandRect(hole, 200, 120, 0.5);
    expect(expanded.x + expanded.width).toBeLessThanOrEqual(200);
    expect(expanded.y + expanded.height).toBeLessThanOrEqual(120);
    expect(expanded.x).toBeGreaterThanOrEqual(0);
    expect(expanded.y).toBeGreaterThanOrEqual(0);
  });
});

describe("prepareLamaInputs", () => {
  it("builds 512 NCHW image and mask tensors with the hole marked", () => {
    const width = 80;
    const height = 60;
    const source = createBuffer(width, height, [10, 20, 30, 255]);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(source, x, y, [x * 3, y * 4, 40, 255]);
      }
    }
    const hole = { x: 50, y: 40, width: 16, height: 10 };
    const prep = prepareLamaInputs(source, hole);

    expect(prep.image.length).toBe(1 * 3 * LAMA_INPUT_SIZE * LAMA_INPUT_SIZE);
    expect(prep.mask.length).toBe(1 * 1 * LAMA_INPUT_SIZE * LAMA_INPUT_SIZE);
    expect(prep.mapping.size).toBe(LAMA_INPUT_SIZE);
    expect(prep.mapping.scale).toBeGreaterThan(0);

    const plane = LAMA_INPUT_SIZE * LAMA_INPUT_SIZE;
    let maxChannel = 0;
    for (let i = 0; i < plane; i += 1) {
      maxChannel = Math.max(maxChannel, prep.image[i], prep.image[plane + i], prep.image[2 * plane + i]);
    }
    expect(maxChannel).toBeLessThanOrEqual(1);
    expect(maxChannel).toBeGreaterThan(0);

    const holeCenterX = hole.x + hole.width / 2;
    const holeCenterY = hole.y + hole.height / 2;
    const tx = Math.round(
      prep.mapping.offsetX + (holeCenterX - prep.mapping.crop.x) * prep.mapping.scale,
    );
    const ty = Math.round(
      prep.mapping.offsetY + (holeCenterY - prep.mapping.crop.y) * prep.mapping.scale,
    );
    expect(prep.mask[ty * LAMA_INPUT_SIZE + tx]).toBe(1);

    let ones = 0;
    let zeros = 0;
    for (let i = 0; i < prep.mask.length; i += 1) {
      if (prep.mask[i] === 1) ones += 1;
      else zeros += 1;
    }
    expect(ones).toBeGreaterThan(100);
    expect(zeros).toBeGreaterThan(ones);
  });
});

describe("buildMaskTensor", () => {
  it("dilates the hole slightly so the mark is fully covered", () => {
    const hole = { x: 20, y: 20, width: 10, height: 10 };
    const mapping = {
      crop: { x: 10, y: 10, width: 40, height: 40 },
      size: LAMA_INPUT_SIZE,
      scale: LAMA_INPUT_SIZE / 40,
      offsetX: 0,
      offsetY: 0,
      scaledWidth: LAMA_INPUT_SIZE,
      scaledHeight: LAMA_INPUT_SIZE,
    };
    const tight = buildMaskTensor(hole, mapping, 0);
    const dilated = buildMaskTensor(hole, mapping, 3);
    let tightCount = 0;
    let dilatedCount = 0;
    for (let i = 0; i < tight.length; i += 1) {
      if (tight[i] > 0) tightCount += 1;
      if (dilated[i] > 0) dilatedCount += 1;
    }
    expect(dilatedCount).toBeGreaterThan(tightCount);
  });
});

describe("compositeLamaOutput", () => {
  it("writes filled pixels inside the hole and keeps distant pixels unchanged", () => {
    const width = 64;
    const height = 48;
    const target = createBuffer(width, height, [12, 34, 56, 255]);
    const hole = { x: 20, y: 16, width: 18, height: 12 };
    const prep = prepareLamaInputs(target, hole);
    const filled = new Float32Array(1 * 3 * LAMA_INPUT_SIZE * LAMA_INPUT_SIZE);
    const plane = LAMA_INPUT_SIZE * LAMA_INPUT_SIZE;
    filled.fill(200, 0, plane);
    filled.fill(10, plane, plane * 2);
    filled.fill(10, plane * 2, plane * 3);

    compositeLamaOutput(target, filled, hole, prep.mapping, COMPOSITE_FEATHER_PX);

    const center = getPixel(target, 29, 22);
    expect(center[0]).toBeGreaterThan(150);
    expect(center[1]).toBeLessThan(40);

    const far = getPixel(target, 2, 2);
    expect(far).toEqual([12, 34, 56, 255]);
  });

  it("fully replaces inside the box and feathers only outside so stamp edges do not halo", () => {
    const width = 80;
    const height = 60;
    const target = createBuffer(width, height, [80, 80, 80, 255]);
    const hole = { x: 24, y: 18, width: 32, height: 24 };
    for (let y = hole.y; y < hole.y + hole.height; y += 1) {
      for (let x = hole.x; x < hole.x + hole.width; x += 1) {
        setPixel(target, x, y, [255, 255, 255, 255]);
      }
    }
    const prep = prepareLamaInputs(target, hole);
    const filled = new Float32Array(1 * 3 * LAMA_INPUT_SIZE * LAMA_INPUT_SIZE);
    filled.fill(0);

    compositeLamaOutput(target, filled, hole, prep.mapping, 8);

    const far = getPixel(target, 8, 30);
    const outsideBlend = getPixel(target, 18, 30);
    const justInside = getPixel(target, 26, 30);
    const center = getPixel(target, 40, 30);
    expect(far[0]).toBe(80);
    expect(center[0]).toBeLessThan(20);
    expect(justInside[0]).toBeLessThan(20);
    expect(outsideBlend[0]).toBeGreaterThan(center[0]);
    expect(outsideBlend[0]).toBeLessThan(80);
  });
});

describe("inpaintWithLama", () => {
  it("fills the selected rectangle using the provided runner", async () => {
    const width = 72;
    const height = 48;
    const buffer = createBuffer(width, height, [30, 90, 40, 255]);
    const hole = { x: 24, y: 16, width: 20, height: 12 };
    for (let y = hole.y; y < hole.y + hole.height; y += 1) {
      for (let x = hole.x; x < hole.x + hole.width; x += 1) {
        setPixel(buffer, x, y, [255, 255, 255, 255]);
      }
    }

    const result = await inpaintWithLama(buffer, hole, {
      runner: {
        async run(image, mask) {
          const out = new Float32Array(image.length);
          const plane = LAMA_INPUT_SIZE * LAMA_INPUT_SIZE;
          for (let i = 0; i < plane; i += 1) {
            const m = mask[i];
            out[i] = m > 0 ? 40 : image[i] * 255;
            out[plane + i] = m > 0 ? 140 : image[plane + i] * 255;
            out[plane * 2 + i] = m > 0 ? 50 : image[plane * 2 + i] * 255;
          }
          return out;
        },
      },
    });

    expect(result.fallback).toBe(false);
    const center = getPixel(buffer, 34, 22);
    expect(center[0]).toBeLessThan(80);
    expect(center[1]).toBeGreaterThan(100);
    const outside = getPixel(buffer, 2, 2);
    expect(outside).toEqual([30, 90, 40, 255]);
  });

  it("falls back to neighbor fill when the runner fails", async () => {
    const width = 80;
    const height = 40;
    const buffer = createBuffer(width, height, [0, 0, 0, 255]);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(buffer, x, y, [Math.round((x / (width - 1)) * 180 + 40), 90, 90, 255]);
      }
    }
    const hole = { x: 28, y: 12, width: 24, height: 14 };
    for (let y = hole.y; y < hole.y + hole.height; y += 1) {
      for (let x = hole.x; x < hole.x + hole.width; x += 1) {
        setPixel(buffer, x, y, [255, 255, 255, 255]);
      }
    }

    const result = await inpaintWithLama(buffer, hole, {
      runner: {
        async run() {
          throw new Error("no webgpu");
        },
      },
    });

    expect(result.fallback).toBe(true);
    const after = getPixel(buffer, 40, 19);
    expect(after[0]).toBeLessThan(255);
    expect(after[0]).not.toBe(255);
  });
});
