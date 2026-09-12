import { classifyFile, formatBytes, formatDuration } from "@/lib/media/validate";
import type { MediaMetadata } from "@/lib/processing/types";

export async function extractImageMetadata(file: File): Promise<MediaMetadata> {
  const bitmap = await createImageBitmap(file);
  const metadata: MediaMetadata = {
    filename: file.name,
    kind: "image",
    mimeType: file.type || "image/png",
    sizeBytes: file.size,
    width: bitmap.width,
    height: bitmap.height,
    durationSeconds: null,
    frameRate: null,
    codec: file.type.replace("image/", "") || "bitmap",
    audioCodec: null,
    rotation: 0,
  };
  bitmap.close();
  return metadata;
}

export async function extractVideoMetadata(file: File): Promise<MediaMetadata> {
  const {
    ALL_FORMATS,
    BlobSource,
    Input,
  } = await import("mediabunny");

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  const [duration, videoTrack, audioTracks] = await Promise.all([
    input.computeDuration(),
    input.getPrimaryVideoTrack(),
    input.getAudioTracks(),
  ]);

  if (!videoTrack) {
    throw new Error("No video track found in this file.");
  }

  const [width, height, packetStats] = await Promise.all([
    videoTrack.getDisplayWidth(),
    videoTrack.getDisplayHeight(),
    videoTrack.computePacketStats().catch(() => null),
  ]);

  const audio = audioTracks[0];
  return {
    filename: file.name,
    kind: "video",
    mimeType: file.type || "video/mp4",
    sizeBytes: file.size,
    width,
    height,
    durationSeconds: duration,
    frameRate: packetStats?.averagePacketRate ?? null,
    codec: videoTrack.codec,
    audioCodec: audio?.codec ?? null,
    rotation: videoTrack.rotation,
  };
}

export async function extractMetadata(file: File): Promise<MediaMetadata> {
  const kind = classifyFile(file);
  if (kind === "image") return extractImageMetadata(file);
  if (kind === "video") return extractVideoMetadata(file);
  throw new Error("Unsupported file type.");
}

export function metadataLines(meta: MediaMetadata): string[] {
  const size = `${meta.width} × ${meta.height}`;
  const fps = meta.frameRate ? `${Math.round(meta.frameRate * 100) / 100} FPS` : null;
  const duration =
    meta.durationSeconds != null ? formatDuration(meta.durationSeconds) : null;
  return [meta.filename, [size, fps, duration, formatBytes(meta.sizeBytes)].filter(Boolean).join("  ")];
}
