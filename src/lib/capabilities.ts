export type BrowserCapabilities = {
  webCodecs: boolean;
  videoDecoder: boolean;
  videoEncoder: boolean;
  offscreenCanvas: boolean;
  wasm: boolean;
  sharedArrayBuffer: boolean;
  highPerformance: boolean;
};

let cached: BrowserCapabilities | null = null;

export function getClientCapabilities(): BrowserCapabilities {
  cached ??= detectCapabilities();
  return cached;
}

export function detectCapabilities(): BrowserCapabilities {
  const videoDecoder = typeof VideoDecoder !== "undefined";
  const videoEncoder = typeof VideoEncoder !== "undefined";
  const webCodecs = videoDecoder && videoEncoder;
  const offscreenCanvas = typeof OffscreenCanvas !== "undefined";
  const wasm = typeof WebAssembly !== "undefined";
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  return {
    webCodecs,
    videoDecoder,
    videoEncoder,
    offscreenCanvas,
    wasm,
    sharedArrayBuffer,
    highPerformance: webCodecs && offscreenCanvas,
  };
}

export function capabilityLabel(capabilities: BrowserCapabilities): {
  title: string;
  detail: string;
} {
  if (capabilities.highPerformance) {
    return {
      title: "High-performance local processing available",
      detail: "WebCodecs will decode and encode on this device.",
    };
  }
  return {
    title: "Compatibility mode",
    detail:
      "Your browser doesn't support the high-performance processing engine. Try Chrome, Edge, or another Chromium-based browser.",
  };
}
