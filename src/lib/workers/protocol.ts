import type {
  DetectionResult,
  ProcessingOptions,
  ProcessingProgress,
  ReconstructionStats,
} from "@/lib/processing/types";

export type MainToWorker =
  | { type: "INIT" }
  | { type: "LOAD_FILE"; file: File }
  | { type: "DETECT" }
  | { type: "GENERATE_PREVIEW"; options: ProcessingOptions }
  | { type: "PROCESS"; options: ProcessingOptions }
  | { type: "CANCEL" };

export type WorkerToMain =
  | { type: "READY" }
  | { type: "DETECTION_RESULT"; detection: DetectionResult }
  | { type: "PREVIEW_PROGRESS" | "PROCESS_PROGRESS"; progress: ProcessingProgress }
  | {
      type: "COMPLETE";
      blob: Blob;
      mimeType: string;
      filename: string;
      width: number;
      height: number;
      durationSeconds: number | null;
      audioPreserved: boolean;
      detection: DetectionResult;
      stats: ReconstructionStats | null;
    }
  | { type: "ERROR"; message: string }
  | { type: "CANCELLED" };
