/// <reference lib="webworker" />

import { classifyFile } from "@/lib/media/validate";
import { extractMetadata } from "@/lib/media/metadata";
import { decodeImageFile, encodePng, processPixelBuffer } from "@/lib/processing/image";
import { detectVideoFile, previewSeconds, processVideoFile } from "@/lib/processing/video";
import type { MainToWorker, WorkerToMain } from "@/lib/workers/protocol";
import type { MediaMetadata, ProcessingOptions } from "@/lib/processing/types";

let file: File | null = null;
let metadata: MediaMetadata | null = null;
let abort: AbortController | null = null;

function post(message: WorkerToMain, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(message, transfer);
}

async function runDetect() {
  if (!file || !metadata) throw new Error("No file loaded.");
  if (metadata.kind === "image") {
    const buffer = await decodeImageFile(file);
    const { detection } = processPixelBuffer(buffer);
    post({ type: "DETECTION_RESULT", detection });
    return;
  }
  const detection = await detectVideoFile(file);
  post({ type: "DETECTION_RESULT", detection });
}

async function runProcess(options: ProcessingOptions, preview: boolean) {
  if (!file || !metadata) throw new Error("No file loaded.");
  abort?.abort();
  abort = new AbortController();
  const kind = metadata.kind;

  if (kind === "image") {
    const buffer = await decodeImageFile(file);
    const { cleaned, detection, stats } = processPixelBuffer(buffer, options);
    const blob = await encodePng(cleaned);
    post({
      type: "COMPLETE",
      blob,
      mimeType: "image/png",
      filename: file.name.replace(/\.[^.]+$/, "") + "-cleaned.png",
      width: cleaned.width,
      height: cleaned.height,
      durationSeconds: null,
      audioPreserved: false,
      detection,
      stats,
    });
    return;
  }

  const videoOptions: ProcessingOptions = preview
    ? { ...options, customPreviewSeconds: previewSeconds(options) }
    : options;

  const result = await processVideoFile(file, videoOptions, {
    signal: abort.signal,
    onProgress: (progress) =>
      post({
        type: preview ? "PREVIEW_PROGRESS" : "PROCESS_PROGRESS",
        progress,
      }),
    onDetection: (detection) => post({ type: "DETECTION_RESULT", detection }),
  });

  post({
    type: "COMPLETE",
    blob: result.blob,
    mimeType: "video/mp4",
    filename: file.name.replace(/\.[^.]+$/, "") + "-cleaned.mp4",
    width: result.width,
    height: result.height,
    durationSeconds: result.durationSeconds,
    audioPreserved: result.audioPreserved,
    detection: result.detection,
    stats: result.stats,
  });
}

self.onmessage = async (event: MessageEvent<MainToWorker>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case "INIT":
        post({ type: "READY" });
        break;
      case "LOAD_FILE":
        file = message.file;
        metadata = await extractMetadata(file);
        break;
      case "DETECT":
        await runDetect();
        break;
      case "GENERATE_PREVIEW":
        await runProcess(message.options, true);
        break;
      case "PROCESS":
        await runProcess(message.options, false);
        break;
      case "CANCEL":
        abort?.abort();
        file = file;
        post({ type: "CANCELLED" });
        break;
      default:
        break;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      post({ type: "CANCELLED" });
      return;
    }
    const text = error instanceof Error ? error.message : "Processing failed.";
    post({ type: "ERROR", message: text });
  }
};

void classifyFile;
