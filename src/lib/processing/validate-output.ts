import type { MediaMetadata } from "./types";

export type OutputCheck = {
  ok: boolean;
  issues: string[];
};

export function validateProcessedOutput(input: {
  source: MediaMetadata;
  output: {
    width: number;
    height: number;
    durationSeconds: number | null;
    frameRate: number | null;
    sizeBytes: number;
  };
}): OutputCheck {
  const issues: string[] = [];
  if (input.output.width !== input.source.width || input.output.height !== input.source.height) {
    issues.push("Output resolution does not match the source.");
  }
  if (
    input.source.durationSeconds != null &&
    input.output.durationSeconds != null &&
    Math.abs(input.output.durationSeconds - input.source.durationSeconds) > 0.08
  ) {
    issues.push("Output duration drifted from the source.");
  }
  if (
    input.source.frameRate != null &&
    input.output.frameRate != null &&
    Math.abs(input.output.frameRate - input.source.frameRate) > 0.6
  ) {
    issues.push("Output frame rate does not match the source.");
  }
  if (!Number.isFinite(input.output.sizeBytes) || input.output.sizeBytes <= 0) {
    issues.push("Output file is empty.");
  }
  return { ok: issues.length === 0, issues };
}
