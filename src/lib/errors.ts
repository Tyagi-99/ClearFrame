export const USER_ERRORS = {
  watermarkNotDetected:
    "We couldn't confidently identify a supported visible overlay.",
  unsupportedWatermark: "This watermark isn't currently supported.",
  lowConfidence:
    "We found a possible overlay, but confidence is too low for automatic processing.",
  browser:
    "Your browser doesn't support the high-performance processing engine. Try Chrome, Edge, or another Chromium-based browser.",
  memory:
    "This video is too large for reliable browser processing. Try a shorter clip or lower-resolution source.",
  codec:
    "Your browser could not process this video format. Try MP4/H.264 or use a Chromium-based browser.",
  cancelled: "Processing was cancelled.",
  validationFailed:
    "The cleaned file did not match the source dimensions, duration, or frame count. Nothing was saved.",
} as const;

export function toUserError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return USER_ERRORS.cancelled;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/codec|decode|encode|unsupported/i.test(message)) return USER_ERRORS.codec;
  if (/memory|quota|array buffer/i.test(message)) return USER_ERRORS.memory;
  if (/webcodecs|videodecoder|videoencoder/i.test(message)) return USER_ERRORS.browser;
  return message || USER_ERRORS.codec;
}
