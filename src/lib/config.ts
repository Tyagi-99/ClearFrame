export const APP_NAME = "ClearFrame";
export const APP_TAGLINE = "Clean your AI-generated videos. Privately. In your browser.";

export const FILE_LIMITS = {
  videoBytes: 500 * 1024 * 1024,
  imageBytes: 50 * 1024 * 1024,
  maxDurationSeconds: 15 * 60,
} as const;

export const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"] as const;
export const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

export const QUEUE_BOUNDS = {
  maxDecode: 8,
  maxProcess: 4,
  maxEncode: 4,
} as const;

export const QUALITY_BITRATE_SCALE = {
  balanced: 0.85,
  high: 1,
  maximum: 1.45,
} as const;
