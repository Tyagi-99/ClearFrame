import { luma } from "./buffer";
import { maskPeak, resizeMask } from "./mask";
import type {
  AlphaMask,
  PixelBox,
  PixelBuffer,
  ReconstructionConfig,
  ReconstructionStats,
} from "./types";

export const DEFAULT_RECONSTRUCTION: ReconstructionConfig = {
  opacity: "auto",
  baseStrength: 1,
  blendCeiling: 0.99,
  overlayLuma: 255,
  stroke: false,
  strokeAlpha: null,
  maskScale: 1,
  edgeDiffusion: "auto",
  diffusionStrength: 0.6,
  dilationRadius: 2,
  maxDiffusionPasses: 120,
};

export function compositePixel(
  original: number,
  overlay: number,
  alpha: number,
): number {
  return overlay * alpha + original * (1 - alpha);
}

export function invertComposite(
  observed: number,
  overlay: number,
  alpha: number,
): number {
  if (alpha <= 0) return observed;
  const safe = Math.min(alpha, 0.999);
  const recovered = (observed - overlay * safe) / (1 - safe);
  if (!Number.isFinite(recovered)) return observed;
  return Math.max(0, Math.min(255, recovered));
}

function slopeOnMask(
  maskData: Float32Array,
  values: Float32Array,
  touched: Uint8Array,
): number {
  let sumMask = 0;
  let sumValue = 0;
  let count = 0;
  for (let i = 0; i < maskData.length; i += 1) {
    if (!touched[i]) continue;
    sumMask += maskData[i];
    sumValue += values[i];
    count += 1;
  }
  if (count < 16) return 0;
  const meanMask = sumMask / count;
  const meanValue = sumValue / count;
  let num = 0;
  let den = 0;
  for (let i = 0; i < maskData.length; i += 1) {
    if (!touched[i]) continue;
    const dm = maskData[i] - meanMask;
    num += dm * (values[i] - meanValue);
    den += dm * dm;
  }
  return den > 1e-9 ? num / den : 0;
}

function boxMean(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const tmp = new Float32Array(width * height);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const base = y * width;
    let sum = 0;
    let count = 0;
    for (let x = 0; x <= radius && x < width; x += 1) {
      sum += src[base + x];
      count += 1;
    }
    for (let x = 0; x < width; x += 1) {
      tmp[base + x] = sum / count;
      if (x + radius + 1 < width) {
        sum += src[base + x + radius + 1];
        count += 1;
      }
      if (x - radius >= 0) {
        sum -= src[base + x - radius];
        count -= 1;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    let count = 0;
    for (let y = 0; y <= radius && y < height; y += 1) {
      sum += tmp[y * width + x];
      count += 1;
    }
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = sum / count;
      if (y + radius + 1 < height) {
        sum += tmp[(y + radius + 1) * width + x];
        count += 1;
      }
      if (y - radius >= 0) {
        sum -= tmp[(y - radius) * width + x];
        count -= 1;
      }
    }
  }
  return out;
}

function highpassPlane(src: Float32Array, size: number, radius: number): Float32Array {
  const mean = boxMean(src, size, size, radius);
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i += 1) out[i] = src[i] - mean[i];
  return out;
}

function markRemoval(
  maskData: Float32Array,
  before: Float32Array,
  after: Float32Array,
  touched: Uint8Array,
  size: number,
): { quality: number; amplitude: number; residual: number } {
  const radius = Math.max(2, Math.round(size / 6));
  const maskHp = highpassPlane(maskData, size, radius);
  const beforeHp = highpassPlane(before, size, radius);
  const afterHp = highpassPlane(after, size, radius);
  const amplitude = slopeOnMask(maskData, before, touched);
  const residual = slopeOnMask(maskData, after, touched);
  const qb = slopeOnMask(maskHp, beforeHp, touched);
  const qa = slopeOnMask(maskHp, afterHp, touched);
  if (Math.abs(qb) < 1e-6) return { quality: 1, amplitude, residual };
  return {
    quality: 1 - Math.abs(qa) / Math.abs(qb),
    amplitude,
    residual,
  };
}

function diffuseLost(
  image: PixelBuffer,
  box: PixelBox,
  lost: Uint8Array,
  config: ReconstructionConfig,
): number {
  const { size } = box;
  const n = size * size;
  let region = lost;
  for (let pass = 0; pass < config.dilationRadius; pass += 1) {
    const grown = new Uint8Array(n);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = y * size + x;
        if (region[i]) {
          grown[i] = 1;
          continue;
        }
        if (
          (x > 0 && region[i - 1]) ||
          (x < size - 1 && region[i + 1]) ||
          (y > 0 && region[i - size]) ||
          (y < size - 1 && region[i + size])
        ) {
          grown[i] = 1;
        }
      }
    }
    region = grown;
  }

  let count = 0;
  for (let i = 0; i < n; i += 1) if (region[i]) count += 1;
  if (!count) return 0;

  const buf = [new Float32Array(n * 3), new Float32Array(n * 3)];
  for (let y = 0, i = 0; y < size; y += 1) {
    const row = ((box.y + y) * image.width + box.x) * 4;
    for (let x = 0; x < size; x += 1, i += 1) {
      const p = row + x * 4;
      for (let c = 0; c < 3; c += 1) {
        buf[0][i * 3 + c] = image.data[p + c];
        buf[1][i * 3 + c] = image.data[p + c];
      }
    }
  }

  let read = 0;
  const strength = config.diffusionStrength;
  for (let iter = 0; iter < config.maxDiffusionPasses; iter += 1) {
    const src = buf[read];
    const dst = buf[1 - read];
    let changed = 0;
    for (let y = 0, i = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1, i += 1) {
        if (!region[i]) continue;
        for (let c = 0; c < 3; c += 1) {
          let sum = 0;
          let neighbors = 0;
          if (x > 0) {
            sum += src[(i - 1) * 3 + c];
            neighbors += 1;
          }
          if (x < size - 1) {
            sum += src[(i + 1) * 3 + c];
            neighbors += 1;
          }
          if (y > 0) {
            sum += src[(i - size) * 3 + c];
            neighbors += 1;
          }
          if (y < size - 1) {
            sum += src[(i + size) * 3 + c];
            neighbors += 1;
          }
          const next = src[i * 3 + c] * (1 - strength) + (sum / Math.max(1, neighbors)) * strength;
          dst[i * 3 + c] = next;
          changed += Math.abs(next - src[i * 3 + c]);
        }
      }
    }
    read = 1 - read;
    if (changed / count < 0.05) break;
  }

  const finalBuf = buf[read];
  for (let y = 0, i = 0; y < size; y += 1) {
    const row = ((box.y + y) * image.width + box.x) * 4;
    for (let x = 0; x < size; x += 1, i += 1) {
      if (!region[i]) continue;
      const p = row + x * 4;
      for (let c = 0; c < 3; c += 1) {
        image.data[p + c] = finalBuf[i * 3 + c] + 0.5;
      }
    }
  }
  return count;
}

export function unblendRegion(
  image: PixelBuffer,
  box: PixelBox,
  mask: AlphaMask,
  config: ReconstructionConfig = DEFAULT_RECONSTRUCTION,
): ReconstructionStats {
  const sized = resizeMask(mask, box.size);
  const gain = config.opacity === "auto" ? 1 : config.opacity;
  const strength = config.baseStrength;
  const n = box.size * box.size;
  const before = new Float32Array(n);
  const after = new Float32Array(n);
  const lost = new Uint8Array(n);
  const touchedMask = new Uint8Array(n);
  let lostCount = 0;
  let clipped = 0;
  let touched = 0;

  for (let y = 0, i = 0; y < box.size; y += 1) {
    const row = ((box.y + y) * image.width + box.x) * 4;
    for (let x = 0; x < box.size; x += 1, i += 1) {
      let alpha = sized.data[i] * gain * strength;
      const p = row + x * 4;
      const currentLuma = luma(image.data[p], image.data[p + 1], image.data[p + 2]);
      if (alpha <= 0) {
        before[i] = currentLuma;
        after[i] = currentLuma;
        continue;
      }
      touchedMask[i] = 1;
      if (alpha >= config.blendCeiling) {
        alpha = config.blendCeiling;
        lost[i] = 1;
        lostCount += 1;
      }
      touched += 1;
      const overlay = sized.overlay ? sized.overlay[i] : config.overlayLuma;
      before[i] = currentLuma;
      for (let c = 0; c < 3; c += 1) {
        const recovered = invertComposite(image.data[p + c], overlay, alpha);
        if (recovered <= 0 || recovered >= 255) clipped += 1;
        image.data[p + c] = recovered + 0.5;
      }
      after[i] = luma(image.data[p], image.data[p + 1], image.data[p + 2]);
    }
  }

  const wantDiffusion =
    config.edgeDiffusion === "on" ||
    (config.edgeDiffusion === "auto" && lostCount > 0 && gain * strength >= 1);
  const diffused =
    wantDiffusion && lostCount > 0
      ? diffuseLost(image, box, lost, config)
      : 0;

  const removal =
    touched > 0
      ? markRemoval(sized.data, before, after, touchedMask, box.size)
      : { quality: 1, amplitude: 0, residual: 0 };

  return {
    box,
    quality: removal.quality,
    markAmplitude: removal.amplitude,
    residualAmplitude: removal.residual,
    clipped,
    touched,
    lost: lostCount,
    diffused,
    alphaPeak: Math.min(config.blendCeiling, maskPeak(sized) * gain * strength),
    opacityUsed: gain,
    gainSolved: config.opacity === "auto" ? null : false,
  };
}

export function pearson(a: ArrayLike<number>, b: ArrayLike<number>, n: number): number {
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i += 1) {
    sa += a[i];
    sb += b[i];
  }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 1e-9 ? num / den : 0;
}

export function markResidual(
  maskData: Float32Array,
  values: Float32Array,
  size: number,
  touched: Uint8Array,
  useHighpass: boolean,
): number {
  const dm = useHighpass
    ? highpassPlane(maskData, size, Math.max(2, Math.round(size / 6)))
    : maskData;
  const dl = useHighpass
    ? highpassPlane(values, size, Math.max(2, Math.round(size / 6)))
    : values;
  const idx: number[] = [];
  for (let i = 0; i < size * size; i += 1) if (touched[i]) idx.push(i);
  if (idx.length < 16) return 0;
  const pm = new Float32Array(idx.length);
  const pl = new Float32Array(idx.length);
  for (let i = 0; i < idx.length; i += 1) {
    pm[i] = dm[idx[i]];
    pl[i] = dl[idx[i]];
  }
  return pearson(pm, pl, idx.length);
}

export { boxMean, highpassPlane };
