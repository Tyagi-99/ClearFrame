import { describe, expect, it } from "vitest";
import { progressFromFrames } from "./progress";

describe("progress calculation", () => {
  it("maps processed frames to a real percentage", () => {
    const start = progressFromFrames(0, 240, "cleaning");
    const mid = progressFromFrames(151, 240, "cleaning");
    const end = progressFromFrames(240, 240, "cleaning");
    expect(start.percent).toBeLessThan(mid.percent);
    expect(mid.percent).toBeLessThan(end.percent);
    expect(mid.frame).toBe(151);
    expect(mid.totalFrames).toBe(240);
    expect(end.ratio).toBeLessThanOrEqual(1);
  });

  it("never reports fake 100% before the last stage completes", () => {
    const encoding = progressFromFrames(240, 240, "encoding");
    expect(encoding.percent).toBeLessThan(100);
  });
});
