import { detectCapabilities } from "@/lib/capabilities";
import { USER_ERRORS } from "@/lib/errors";
import { QUALITY_BITRATE_SCALE } from "@/lib/config";
import { detectWatermark, cleanBuffer } from "./detect";
import { bufferFromImageData } from "./buffer";
import { defaultOtherRegion, normalizedToRect } from "./geometry";
import { inpaintRect } from "./inpaint";
import type { LamaRunner } from "./lama";
import type {
  DetectionResult,
  ProcessingOptions,
  ProcessingProgress,
  ReconstructionStats,
} from "./types";
import { progressFromRatio } from "./progress";

export type VideoProcessResult = {
  blob: Blob;
  width: number;
  height: number;
  durationSeconds: number;
  frameRate: number | null;
  audioPreserved: boolean;
  detection: DetectionResult;
  stats: ReconstructionStats | null;
};

type VideoHooks = {
  signal?: AbortSignal;
  onProgress?: (progress: ProcessingProgress) => void;
  onDetection?: (detection: DetectionResult) => void;
};

function qualityFor(options: ProcessingOptions) {
  if (options.quality === "balanced") return "medium" as const;
  if (options.quality === "maximum") return "very-high" as const;
  return "high" as const;
}

async function detectVideoTrack(
  videoTrack: {
    getDisplayWidth?: () => Promise<number>;
  } & object,
  duration: number,
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
): Promise<DetectionResult> {
  const { VideoSampleSink } = await import("mediabunny");
  const sink = new VideoSampleSink(
    videoTrack as ConstructorParameters<typeof VideoSampleSink>[0],
  );
  const sampleTimes = [0, Math.min(0.4, duration / 3), Math.min(1.2, duration * 0.7)];
  let detection: DetectionResult | null = null;
  for (const time of sampleTimes) {
    const sample = await sink.getSample(time);
    if (!sample) continue;
    sample.draw(ctx, 0, 0);
    sample.close();
    const image = ctx.getImageData(0, 0, width, height);
    detection = detectWatermark(bufferFromImageData(image), "google-flow-visible");
    if (detection.detected && !detection.lowConfidence) break;
  }
  if (!detection) throw new Error(USER_ERRORS.watermarkNotDetected);
  return detection;
}

export async function detectVideoFile(file: File): Promise<DetectionResult> {
  const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error(USER_ERRORS.codec);
  const [width, height, duration] = await Promise.all([
    videoTrack.getDisplayWidth(),
    videoTrack.getDisplayHeight(),
    input.computeDuration(),
  ]);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not open a drawing surface for this video.");
  return detectVideoTrack(videoTrack, duration, ctx, width, height);
}

export async function processVideoFile(
  file: File,
  options: ProcessingOptions,
  hooks: VideoHooks = {},
): Promise<VideoProcessResult> {
  const capabilities = detectCapabilities();
  if (!capabilities.webCodecs) {
    throw new Error(USER_ERRORS.browser);
  }

  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
  } = await import("mediabunny");

  hooks.onProgress?.(progressFromRatio(0.02, "preparing"));

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error(USER_ERRORS.codec);

  const [width, height, duration, audioTracks] = await Promise.all([
    videoTrack.getDisplayWidth(),
    videoTrack.getDisplayHeight(),
    input.computeDuration(),
    input.getAudioTracks(),
  ]);

  hooks.onProgress?.(progressFromRatio(0.06, "detecting"));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not open a drawing surface for this video.");

  const other = options.target === "other";
  const region = options.region ?? (other ? defaultOtherRegion() : undefined);
  let lamaRunner: LamaRunner | null = null;
  let lamaApi: typeof import("./lama") | null = null;
  if (other) {
    hooks.onProgress?.({
      stage: "preparing",
      ratio: 0.08,
      percent: 8,
      message: "Loading fill model…",
    });
    try {
      lamaApi = await import("./lama");
      lamaRunner = await lamaApi.getLamaRunner((ratio, message) =>
        hooks.onProgress?.({
          stage: "preparing",
          ratio,
          percent: Math.round(ratio * 100),
          message,
        }),
      );
    } catch {
      lamaRunner = null;
      lamaApi = null;
    }
  }
  const detection: DetectionResult = other
    ? {
        detected: true,
        profileId: "other-manual",
        confidence: 1,
        score: 1,
        region: region ?? defaultOtherRegion(),
        box: { x: 0, y: 0, size: 8 },
        markSize: 8,
        anchored: false,
        lowConfidence: false,
        message: null,
      }
    : await detectVideoTrack(videoTrack, duration, ctx, width, height);
  if (region) detection.region = region;
  hooks.onDetection?.(detection);

  const lockedBox = region
    ? {
        x: Math.round(region.x * width),
        y: Math.round(region.y * height),
        size: Math.round(((region.width * width) + (region.height * height)) / 2),
      }
    : detection.box;
  const lockedRect = normalizedToRect(detection.region, width, height);

  let lastStats: ReconstructionStats | null = null;
  let frames = 0;
  const started = performance.now();

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });

  const conversion = await Conversion.init({
    input,
    output,
    copy: false,
    trim:
      options.customPreviewSeconds != null
        ? { start: 0, end: options.customPreviewSeconds }
        : undefined,
    video: {
      forceTranscode: true,
      quality: new Quality(qualityFor(options)),
      process: async (sample) => {
        if (hooks.signal?.aborted) {
          sample.close();
          throw new DOMException("Processing cancelled", "AbortError");
        }
        if (canvas.width !== sample.displayWidth || canvas.height !== sample.displayHeight) {
          canvas.width = sample.displayWidth;
          canvas.height = sample.displayHeight;
        }
        sample.draw(ctx, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = bufferFromImageData(image);
        if (other) {
          if (lamaRunner && lamaApi) {
            const filled = await lamaApi.inpaintWithLama(pixels, lockedRect, {
              runner: lamaRunner,
            });
            if (filled.fallback && !detection.message) {
              detection.message =
                "Fill model unavailable. Used a simple blend instead — the result may look patched.";
            }
          } else {
            inpaintRect(pixels, lockedRect);
            if (!detection.message) {
              detection.message =
                "Fill model unavailable. Used a simple blend instead — the result may look patched.";
            }
          }
        } else {
          lastStats = cleanBuffer(pixels, lockedBox);
        }
        ctx.putImageData(image, 0, 0);
        frames += 1;
        return canvas;
      },
    },
  });

  if (!conversion.isValid) {
    const reason = conversion.discardedTracks[0]?.reason;
    if (reason === "undecodable_source_codec" || reason === "no_encodable_target_codec") {
      throw new Error(USER_ERRORS.codec);
    }
    throw new Error(USER_ERRORS.browser);
  }

  const abort = () => {
    void conversion.cancel();
  };
  hooks.signal?.addEventListener("abort", abort, { once: true });

  conversion.onProgress = (ratio) => {
    const elapsed = (performance.now() - started) / 1000;
    const eta = ratio > 0.05 ? elapsed / ratio - elapsed : null;
    hooks.onProgress?.(
      progressFromRatio(0.12 + ratio * 0.82, "cleaning", {
        frame: frames,
        etaSeconds: eta,
      }),
    );
  };

  try {
    await conversion.execute();
  } finally {
    hooks.signal?.removeEventListener("abort", abort);
  }

  hooks.onProgress?.(progressFromRatio(0.96, "audio"));
  const buffer = output.target.buffer;
  if (!buffer) throw new Error(USER_ERRORS.validationFailed);
  const blob = new Blob([buffer], { type: "video/mp4" });

  hooks.onProgress?.(progressFromRatio(1, "finalizing"));

  return {
    blob,
    width,
    height,
    durationSeconds: duration,
    frameRate: null,
    audioPreserved: audioTracks.length > 0,
    detection,
    stats: lastStats,
  };
}

export function previewSeconds(options: ProcessingOptions): number {
  if (options.customPreviewSeconds) return options.customPreviewSeconds;
  if (options.previewDuration === 10) return 10;
  return 5;
}

export { QUALITY_BITRATE_SCALE };
