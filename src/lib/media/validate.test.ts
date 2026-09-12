import { describe, expect, it } from "vitest";
import { classifyFile, formatBytes, formatDuration, validateFile } from "./validate";

function fakeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 8))], { type });
  Object.defineProperty(blob, "size", { value: size });
  return new File([blob], name, { type });
}

describe("file validation", () => {
  it("accepts a supported MP4 under the size limit", () => {
    const result = validateFile(fakeFile("mountain.mp4", "video/mp4", 42_300_000));
    expect(result).toEqual({ ok: true, kind: "video" });
  });

  it("accepts PNG images", () => {
    expect(classifyFile(fakeFile("still.png", "image/png", 1200))).toBe("image");
  });

  it("rejects unsupported containers", () => {
    const result = validateFile(fakeFile("clip.avi", "video/x-msvideo", 1000));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported-type");
  });

  it("rejects videos over 500 MB", () => {
    const result = validateFile(fakeFile("huge.mp4", "video/mp4", 501 * 1024 * 1024));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("too-large");
  });
});

describe("formatting", () => {
  it("formats file size with one decimal under 10 MB", () => {
    expect(formatBytes(42.3 * 1024 * 1024)).toBe("42.3 MB");
  });

  it("formats duration as mm:ss", () => {
    expect(formatDuration(8)).toBe("00:08");
    expect(formatDuration(125)).toBe("02:05");
  });
});
