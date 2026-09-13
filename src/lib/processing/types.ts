export type PixelBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type AlphaMask = {
  size: number;
  data: Float32Array;
  overlay?: Float32Array;
};

export type PixelBox = {
  x: number;
  y: number;
  size: number;
};

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CleanerTarget = "gemini" | "other";

export type NormalizedRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReconstructionConfig = {
  opacity: number | "auto";
  baseStrength: number;
  blendCeiling: number;
  overlayLuma: number;
  stroke: boolean;
  strokeAlpha: number | null;
  maskScale: number;
  edgeDiffusion: "auto" | "on" | "off";
  diffusionStrength: number;
  dilationRadius: number;
  maxDiffusionPasses: number;
};

export type DetectionResult = {
  detected: boolean;
  profileId: string;
  confidence: number;
  score: number;
  region: NormalizedRegion;
  box: PixelBox;
  markSize: number;
  anchored: boolean;
  lowConfidence: boolean;
  message: string | null;
};

export type ReconstructionStats = {
  box: PixelBox;
  quality: number;
  markAmplitude: number;
  residualAmplitude: number;
  clipped: number;
  touched: number;
  lost: number;
  diffused: number;
  alphaPeak: number;
  opacityUsed: number;
  gainSolved: boolean | null;
};

export type ProcessingQuality = "balanced" | "high" | "maximum";
export type DetectionSensitivity = "auto" | "conservative" | "aggressive";
export type ProcessingEngineId = "webcodecs" | "compatibility";
export type PreviewDuration = 5 | 10 | "first-scene";

export type ProcessingOptions = {
  quality: ProcessingQuality;
  engine: ProcessingEngineId;
  previewDuration: PreviewDuration;
  customPreviewSeconds?: number;
  detectionSensitivity: DetectionSensitivity;
  target?: CleanerTarget;
  region?: NormalizedRegion;
  lockRegion?: boolean;
};

export type ProgressStage =
  | "preparing"
  | "detecting"
  | "decoding"
  | "cleaning"
  | "encoding"
  | "audio"
  | "finalizing";

export type ProcessingProgress = {
  stage: ProgressStage;
  ratio: number;
  percent: number;
  frame?: number;
  totalFrames?: number;
  etaSeconds?: number | null;
  message: string;
};

export type MediaKind = "image" | "video";

export type MediaMetadata = {
  filename: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  frameRate: number | null;
  codec: string | null;
  audioCodec: string | null;
  rotation: number;
};

export type ProcessedMedia = {
  blob: Blob;
  mimeType: string;
  filename: string;
  width: number;
  height: number;
  durationSeconds: number | null;
  frameRate: number | null;
  sizeBytes: number;
  audioPreserved: boolean;
  detection: DetectionResult;
  stats: ReconstructionStats;
};

export type ProcessedPreview = {
  original: PixelBuffer;
  cleaned: PixelBuffer;
  detection: DetectionResult;
  stats: ReconstructionStats;
  blob: Blob;
  mimeType: string;
};
