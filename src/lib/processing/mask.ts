import geminiMaskBase64 from "./gemini-mask-48.json";
import type { AlphaMask } from "./types";

const PEAK_ALPHA = 129 / 255;
const SPARKLE = { corner: 1.2, extent: 1.12, peakAlpha: PEAK_ALPHA };

let cachedGemini: AlphaMask | null = null;

function decodeBase64Mask(encoded: string): AlphaMask {
  const binary =
    typeof atob === "function"
      ? atob(encoded)
      : Buffer.from(encoded, "base64").toString("binary");
  const size = Math.round(Math.sqrt(binary.length));
  const data = new Float32Array(size * size);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = binary.charCodeAt(i) / 255;
  }
  return { size, data };
}

/**
 * Measured 48x48 Gemini sparkle alpha map.
 *
 * Source: seeb4coding/seeb4-erase (MIT). Captured from solid-black Gemini
 * output where the composite collapses to alpha * 255, so luma/255 is alpha.
 * Peak byte is 129 (alpha 0.5059). Size is a fixed sprite, not resolution-scaled
 * for stills.
 */
export function geminiMask(): AlphaMask {
  if (cachedGemini) {
    return { size: cachedGemini.size, data: cachedGemini.data };
  }
  cachedGemini = decodeBase64Mask(geminiMaskBase64);
  return { size: cachedGemini.size, data: cachedGemini.data };
}

export function maskPeak(mask: AlphaMask): number {
  let peak = 0;
  for (let i = 0; i < mask.data.length; i += 1) {
    if (mask.data[i] > peak) peak = mask.data[i];
  }
  return peak;
}

export function sparkleMask(size = 48): AlphaMask {
  const data = new Float32Array(size * size);
  const samples = 4;
  const c = SPARKLE.corner;
  const s = SPARKLE.extent;
  const r2 = (1 - c) * (1 - c) + c * c;
  const inv = 1 / samples;
  const sub = inv * inv;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let cover = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        const gy = (((y + (sy + 0.5) * inv) / size) * 2 - 1) / s;
        for (let sx = 0; sx < samples; sx += 1) {
          const gx = (((x + (sx + 0.5) * inv) / size) * 2 - 1) / s;
          let inside = true;
          for (let qy = -1; qy <= 1 && inside; qy += 2) {
            for (let qx = -1; qx <= 1 && inside; qx += 2) {
              const dx = gx - qx * c;
              const dy = gy - qy * c;
              if (dx * dx + dy * dy < r2) inside = false;
            }
          }
          if (inside) cover += sub;
        }
      }
      data[y * size + x] = cover * SPARKLE.peakAlpha;
    }
  }
  return { size, data };
}

function resizePlane(src: Float32Array, n: number, size: number): Float32Array {
  const out = new Float32Array(size * size);
  const ratio = n / size;
  for (let y = 0; y < size; y += 1) {
    const fy = Math.min(n - 1, Math.max(0, (y + 0.5) * ratio - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(n - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < size; x += 1) {
      const fx = Math.min(n - 1, Math.max(0, (x + 0.5) * ratio - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(n - 1, x0 + 1);
      const wx = fx - x0;
      const top = src[y0 * n + x0] * (1 - wx) + src[y0 * n + x1] * wx;
      const bot = src[y1 * n + x0] * (1 - wx) + src[y1 * n + x1] * wx;
      out[y * size + x] = top * (1 - wy) + bot * wy;
    }
  }
  return out;
}

export function resizeMask(mask: AlphaMask, size: number): AlphaMask {
  if (size === mask.size) {
    const out: AlphaMask = { size, data: mask.data.slice() };
    if (mask.overlay) out.overlay = mask.overlay.slice();
    return out;
  }
  const out: AlphaMask = { size, data: resizePlane(mask.data, mask.size, size) };
  if (mask.overlay) out.overlay = resizePlane(mask.overlay, mask.size, size);
  return out;
}

export { PEAK_ALPHA };
