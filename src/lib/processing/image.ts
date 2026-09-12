import { cloneBuffer } from "./buffer";
import { detectWatermark, cleanBuffer } from "./detect";
import { normalizedToBox } from "./geometry";
import { DEFAULT_RECONSTRUCTION } from "./reconstruct";
import type {
  DetectionResult,
  PixelBuffer,
  ProcessingOptions,
  ReconstructionStats,
} from "./types";

export function processPixelBuffer(
  source: PixelBuffer,
  options: Partial<ProcessingOptions> = {},
): {
  cleaned: PixelBuffer;
  detection: DetectionResult;
  stats: ReconstructionStats;
} {
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
