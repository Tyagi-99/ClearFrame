import { geminiMask } from "@/lib/processing/mask";
import type { AlphaMask, MediaKind } from "@/lib/processing/types";

export type WatermarkProfile = {
  id: string;
  name: string;
  mediaTypes: MediaKind[];
  summary: string;
  detector: "gemini-sparkle";
  reconstruction: "inverse-alpha";
};

export const WATERMARK_PROFILES: WatermarkProfile[] = [
  {
    id: "google-flow-visible",
    name: "Google Flow",
    mediaTypes: ["video"],
    summary: "Supported visible overlay",
    detector: "gemini-sparkle",
    reconstruction: "inverse-alpha",
  },
  {
    id: "google-gemini-visible",
    name: "Google Gemini",
    mediaTypes: ["video", "image"],
    summary: "Supported visible overlay",
    detector: "gemini-sparkle",
    reconstruction: "inverse-alpha",
  },
  {
    id: "google-veo-visible",
    name: "Veo-compatible",
    mediaTypes: ["video"],
    summary: "Supported visible overlay",
    detector: "gemini-sparkle",
    reconstruction: "inverse-alpha",
  },
];

export function profileMask(profileId: string): AlphaMask {
  void profileId;
  return geminiMask();
}

export function profileById(id: string): WatermarkProfile | undefined {
  return WATERMARK_PROFILES.find((profile) => profile.id === id);
}
