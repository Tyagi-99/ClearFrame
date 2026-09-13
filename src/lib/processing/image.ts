import { cloneBuffer } from "./buffer";
import { detectWatermark, cleanBuffer } from "./detect";
import { defaultOtherRegion, normalizedToBox, normalizedToRect } from "./geometry";
import { DEFAULT_RECONSTRUCTION } from "./reconstruct";
import type {
  DetectionResult,
  PixelBuffer,
  ProcessingOptions,
  ProcessingProgress,
  ReconstructionStats,
} from "./types";

function emptyStats(box: DetectionResult["box"]): ReconstructionStats {
  return {
    box,
    quality: 1,
    markAmplitude: 0,
    residualAmplitude: 0,
    clipped: 0,
    touched: 0,
    lost: 0,
    diffused: 0,
    alphaPeak: 0,
    opacityUsed: 1,
    gainSolved: null,
  };
}

function otherDetection(
  source: PixelBuffer,
  region = defaultOtherRegion(),
): DetectionResult {
  const rect = normalizedToRect(region, source.width, source.height);
  return {
    detected: true,
    profileId: "other-manual",
    confidence: 1,
    score: 1,
    region,
    box: { x: rect.x, y: rect.y, size: Math.min(rect.width, rect.height) },
    markSize: Math.min(rect.width, rect.height),
    anchored: false,
    lowConfidence: false,
    message: null,
  };
}

export async function processPixelBuffer(
  source: PixelBuffer,
  options: Partial<ProcessingOptions> = {},
  onProgress?: (progress: ProcessingProgress) => void,
): Promise<{
  cleaned: PixelBuffer;
  detection: DetectionResult;
  stats: ReconstructionStats;
}> {
  if (options.target === "other") {
    const detection = otherDetection(source, options.region ?? defaultOtherRegion());
    const cleaned = cloneBuffer(source);
    const { inpaintWithLama } = await import("./lama");
    const result = await inpaintWithLama(
      cleaned,
      normalizedToRect(detection.region, source.width, source.height),
      {
        onProgress: (ratio, message) =>
          onProgress?.({
            stage: "preparing",
            ratio,
            percent: Math.round(ratio * 100),
            message,
          }),
      },
    );
    if (result.fallback) {
      detection.message =
        "Fill model unavailable. Used a simple blend instead — the result may look patched.";
    }
    return { cleaned, detection, stats: emptyStats(detection.box) };
  }

  const detection = detectWatermark(source);
  if (options.region) {
    detection.box = normalizedToBox(options.region, source.width, source.height);
    detection.region = options.region;
    detection.detected = true;
    detection.lowConfidence = false;
    detection.message = null;
  }
  const cleaned = cloneBuffer(source);
  const stats = cleanBuffer(cleaned, detection.box, DEFAULT_RECONSTRUCTION);
  return { cleaned, detection, stats };
}

export async function decodeImageFile(file: Blob): Promise<PixelBuffer> {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not open a drawing surface for this image.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, data: image.data };
}

export async function encodePng(buffer: PixelBuffer): Promise<Blob> {
  const canvas = new OffscreenCanvas(buffer.width, buffer.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not encode this image.");
  const pixels = new ImageData(buffer.width, buffer.height);
  pixels.data.set(buffer.data);
  ctx.putImageData(pixels, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
