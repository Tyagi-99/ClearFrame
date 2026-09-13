import {
  FILE_LIMITS,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_VIDEO_TYPES,
} from "@/lib/config";
import type { MediaKind } from "@/lib/processing/types";

export type ValidationErrorCode =
  | "unsupported-type"
  | "too-large"
  | "empty"
  | "too-long"
  | "wrong-kind";

export type ValidationResult =
  | { ok: true; kind: MediaKind }
  | { ok: false; code: ValidationErrorCode; message: string };

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function parseMediaKind(value: string | null | undefined): MediaKind | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "image" || normalized === "photo" || normalized === "photos") {
    return "image";
  }
  if (normalized === "video") return "video";
  return null;
}

export function classifyFile(file: File): MediaKind | null {
  const ext = extensionOf(file.name);
  if (
    SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number]) ||
    SUPPORTED_IMAGE_EXTENSIONS.includes(ext as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number])
  ) {
    return "image";
  }
  if (
    SUPPORTED_VIDEO_TYPES.includes(file.type as (typeof SUPPORTED_VIDEO_TYPES)[number]) ||
    SUPPORTED_VIDEO_EXTENSIONS.includes(ext as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number])
  ) {
    return "video";
  }
  return null;
}

export function validateFile(file: File, expectedKind?: MediaKind): ValidationResult {
  if (file.size <= 0) {
    return {
      ok: false,
      code: "empty",
      message: "That file is empty. Choose an image or MP4 to continue.",
    };
  }

  const kind = classifyFile(file);
  if (!kind) {
    return {
      ok: false,
      code: "unsupported-type",
      message: "Your browser could not process this video format. Try MP4/H.264 or use a Chromium-based browser.",
    };
  }

  if (expectedKind && kind !== expectedKind) {
    return {
      ok: false,
      code: "wrong-kind",
      message:
        expectedKind === "image"
          ? "This option is for photos. Drop a PNG, JPG, or WebP, or switch to Video."
          : "This option is for video. Drop an MP4 or WebM, or switch to Photo.",
    };
  }

  const limit = kind === "video" ? FILE_LIMITS.videoBytes : FILE_LIMITS.imageBytes;
  if (file.size > limit) {
    return {
      ok: false,
      code: "too-large",
      message:
        kind === "video"
          ? "This video is too large for reliable browser processing. Try a shorter clip or lower-resolution source."
          : "This image is larger than the 50 MB limit.",
    };
  }

  return { ok: true, kind };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
