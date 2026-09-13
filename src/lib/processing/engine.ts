import { decodeImageFile, encodePng, processPixelBuffer } from "@/lib/processing/image";
import { detectVideoFile, processVideoFile, previewSeconds } from "@/lib/processing/video";
import { classifyFile } from "@/lib/media/validate";
import type {
  DetectionResult,
  ProcessedMedia,
  ProcessedPreview,
  ProcessingEngineId,
  ProcessingOptions,
  ProcessingProgress,
} from "@/lib/processing/types";

export interface ProcessingEngine {
  detectWatermark(source: File): Promise<DetectionResult>;
  generatePreview(
    source: File,
    options: ProcessingOptions,
  ): Promise<ProcessedPreview>;
  processMedia(
    source: File,
    options: ProcessingOptions,
    onProgress: (progress: ProcessingProgress) => void,
  ): Promise<ProcessedMedia>;
  cancel(): Promise<void>;
}

export function createProcessingEngine(
  preferred: ProcessingEngineId = "webcodecs",
): ProcessingEngine {
  void preferred;
  let abort: AbortController | null = null;

  return {
    async detectWatermark(source) {
      const kind = classifyFile(source);
      if (kind === "image") {
        const buffer = await decodeImageFile(source);
        return (await processPixelBuffer(buffer)).detection;
      }
      return detectVideoFile(source);
    },

    async generatePreview(source, options) {
      const kind = classifyFile(source);
      if (kind === "image") {
        const original = await decodeImageFile(source);
        const { cleaned, detection, stats } = await processPixelBuffer(original, options);
        const blob = await encodePng(cleaned);
        return {
          original,
          cleaned,
          detection,
          stats,
          blob,
          mimeType: "image/png",
        };
      }
      abort?.abort();
      abort = new AbortController();
      const result = await processVideoFile(
        source,
        { ...options, customPreviewSeconds: previewSeconds(options) },
        { signal: abort.signal },
      );
      const cleaned = await decodeImageFile(result.blob).catch(() => null);
      return {
        original: cleaned ?? {
          width: result.width,
          height: result.height,
          data: new Uint8ClampedArray(result.width * result.height * 4),
        },
        cleaned: cleaned ?? {
          width: result.width,
          height: result.height,
          data: new Uint8ClampedArray(result.width * result.height * 4),
        },
        detection: result.detection,
        stats: result.stats ?? {
          box: result.detection.box,
          quality: 0,
          markAmplitude: 0,
          residualAmplitude: 0,
          clipped: 0,
          touched: 0,
          lost: 0,
          diffused: 0,
          alphaPeak: 0,
          opacityUsed: 1,
          gainSolved: null,
        },
        blob: result.blob,
        mimeType: "video/mp4",
      };
    },

    async processMedia(source, options, onProgress) {
      abort?.abort();
      abort = new AbortController();
      const kind = classifyFile(source);
      if (kind === "image") {
        if (options.target === "other") {
          onProgress({
            stage: "preparing",
            ratio: 0.08,
            percent: 8,
            message: "Loading fill model…",
          });
        } else {
          onProgress({
            stage: "cleaning",
            ratio: 0.4,
            percent: 40,
            message: "Cleaning frames...",
          });
        }
        const original = await decodeImageFile(source);
        const { cleaned, detection, stats } = await processPixelBuffer(
          original,
          options,
          onProgress,
        );
        const blob = await encodePng(cleaned);
        onProgress({
          stage: "finalizing",
          ratio: 1,
          percent: 100,
          message: "Finalizing output...",
        });
        return {
          blob,
          mimeType: "image/png",
          filename: source.name.replace(/\.[^.]+$/, "") + "-cleaned.png",
          width: cleaned.width,
          height: cleaned.height,
          durationSeconds: null,
          frameRate: null,
          sizeBytes: blob.size,
          audioPreserved: false,
          detection,
          stats,
        };
      }

      const result = await processVideoFile(source, options, {
        signal: abort.signal,
        onProgress,
      });
      return {
        blob: result.blob,
        mimeType: "video/mp4",
        filename: source.name.replace(/\.[^.]+$/, "") + "-cleaned.mp4",
        width: result.width,
        height: result.height,
        durationSeconds: result.durationSeconds,
        frameRate: result.frameRate,
        sizeBytes: result.blob.size,
        audioPreserved: result.audioPreserved,
        detection: result.detection,
        stats: result.stats ?? {
          box: result.detection.box,
          quality: 0,
          markAmplitude: 0,
          residualAmplitude: 0,
          clipped: 0,
          touched: 0,
          lost: 0,
          diffused: 0,
          alphaPeak: 0,
          opacityUsed: 1,
          gainSolved: null,
        },
      };
    },

    async cancel() {
      abort?.abort();
      abort = null;
    },
  };
}
