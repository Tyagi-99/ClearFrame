import type { ProcessingProgress, ProgressStage } from "./types";

export const STAGE_COPY: Record<ProgressStage, string> = {
  preparing: "Preparing video...",
  detecting: "Detecting watermark...",
  decoding: "Decoding frames...",
  cleaning: "Cleaning frames...",
  encoding: "Encoding video...",
  audio: "Restoring audio...",
  finalizing: "Finalizing output...",
};

const STAGE_WEIGHT: Record<ProgressStage, number> = {
  preparing: 0.04,
  detecting: 0.08,
  decoding: 0.28,
  cleaning: 0.28,
  encoding: 0.24,
  audio: 0.04,
  finalizing: 0.04,
};

const STAGE_ORDER: ProgressStage[] = [
  "preparing",
  "detecting",
  "decoding",
  "cleaning",
  "encoding",
  "audio",
  "finalizing",
];

export function progressFromFrames(
  frame: number,
  totalFrames: number,
  stage: ProgressStage = "cleaning",
): ProcessingProgress {
  const safeTotal = Math.max(1, totalFrames);
  const frameRatio = Math.max(0, Math.min(1, frame / safeTotal));
  let completed = 0;
  for (const item of STAGE_ORDER) {
    if (item === stage) break;
    completed += STAGE_WEIGHT[item];
  }
  const ratio = Math.max(0, Math.min(1, completed + STAGE_WEIGHT[stage] * frameRatio));
  return {
    stage,
    ratio,
    percent: Math.round(ratio * 100),
    frame,
    totalFrames: safeTotal,
    etaSeconds: null,
    message: STAGE_COPY[stage],
  };
}

export function progressFromRatio(
  ratio: number,
  stage: ProgressStage,
  extras: Partial<ProcessingProgress> = {},
): ProcessingProgress {
  const clamped = Math.max(0, Math.min(1, ratio));
  return {
    stage,
    ratio: clamped,
    percent: Math.round(clamped * 100),
    etaSeconds: null,
    message: STAGE_COPY[stage],
    ...extras,
  };
}
