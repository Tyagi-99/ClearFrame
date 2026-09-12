import { luma } from "./buffer";
import { anchorBoxes, boxToNormalized, defaultBox, seedSizes } from "./geometry";
import { geminiMask, maskPeak, resizeMask } from "./mask";
import { boxMean, DEFAULT_RECONSTRUCTION, markResidual, unblendRegion } from "./reconstruct";
import type {
  AlphaMask,
  DetectionResult,
  PixelBox,
  PixelBuffer,
  ReconstructionConfig,
  ReconstructionStats,
} from "./types";

export const ANCHOR_MARGIN = 0.1;
export const MIN_DETECT_SCORE = 0.3;
export const LOW_CONFIDENCE_SCORE = 0.55;

type HighpassImage = { data: Float32Array; width: number; height: number };

function detailRadius(size: number): number {
  return Math.max(2, Math.round(size / 6));
}

function detailSmooth(size: number): number {
  return Math.max(1, Math.round(size / 32));
}

export function highpassImage(
  image: PixelBuffer,
  radius: number,
  smooth: number,
): HighpassImage {
  const n = image.width * image.height;
  let plane = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i += 1, p += 4) {
    plane[i] = luma(image.data[p], image.data[p + 1], image.data[p + 2]);
  }
  if (smooth > 0) plane = new Float32Array(boxMean(plane, image.width, image.height, smooth));
  const mean = boxMean(plane, image.width, image.height, radius);
  const hp = new Float32Array(n);
  for (let i = 0; i < n; i += 1) hp[i] = plane[i] - mean[i];
  return { data: hp, width: image.width, height: image.height };
}

function highpass(
  src: Float32Array,
  size: number,
  radius: number,
  smooth: number,
): Float32Array {
  let plane = src;
  if (smooth > 0) plane = boxMean(src, size, size, smooth);
  return boxMean
    ? (() => {
        const mean = boxMean(plane, size, size, radius);
        const out = new Float32Array(size * size);
        for (let i = 0; i < out.length; i += 1) out[i] = plane[i] - mean[i];
        return out;
      })()
    : plane;
}

export function detectAtSize(
  image: PixelBuffer,
  mask: AlphaMask,
  opts: {
    size: number;
    hp?: HighpassImage;
    radius?: number;
    smooth?: number;
    region?: { x0: number; y0: number; x1: number; y1: number };
  },
): PixelBox & { score: number } {
  const size = opts.size;
  const { width: W, height: H } = image;
  if (size > W || size > H) return { x: 0, y: 0, size, score: -2 };

  const radius = opts.radius ?? detailRadius(size);
  const smooth = opts.smooth ?? detailSmooth(size);
  const hp =
    opts.hp && opts.hp.width === W && opts.hp.height === H
      ? opts.hp
      : highpassImage(image, radius, smooth);
  const m = highpass(resizeMask(mask, size).data, size, radius, smooth);
  const n = size * size;
  let mSum = 0;
  for (let i = 0; i < n; i += 1) mSum += m[i];
  const mMean = mSum / n;
  let mVar = 0;
  for (let i = 0; i < n; i += 1) {
    const dm = m[i] - mMean;
    mVar += dm * dm;
  }
  if (mVar < 1e-9) return { x: 0, y: 0, size, score: -2 };
  const mSd = Math.sqrt(mVar);

  const region = opts.region ?? { x0: 0, y0: 0, x1: W - size, y1: H - size };
  const x0 = Math.max(0, region.x0);
  const y0 = Math.max(0, region.y0);
  const x1 = Math.min(W - size, region.x1);
  const y1 = Math.min(H - size, region.y1);
  if (x1 < x0 || y1 < y0) return { x: x0, y: y0, size, score: -2 };

  let best = { x: x0, y: y0, size, score: -2 };

  const scoreAt = (ox: number, oy: number): number => {
    let lSum = 0;
    let lSq = 0;
    let cross = 0;
    for (let y = 0; y < size; y += 1) {
      const row = (oy + y) * W + ox;
      for (let x = 0; x < size; x += 1) {
        const v = hp.data[row + x];
        lSum += v;
        lSq += v * v;
        cross += v * m[y * size + x];
      }
    }
    const lVar = lSq - (lSum * lSum) / n;
    if (lVar < 1e-6) return -2;
    return (cross - mMean * lSum) / (mSd * Math.sqrt(lVar));
  };

  const sweep = (ax: number, ay: number, bx: number, by: number, step: number) => {
    for (let y = ay; y <= by; y += step) {
      for (let x = ax; x <= bx; x += step) {
        const s = scoreAt(x, y);
        if (s > best.score) best = { x, y, size, score: s };
      }
    }
  };

  const coarse = Math.max(2, Math.round(size / 6));
  sweep(x0, y0, x1, y1, coarse);
  sweep(
    Math.max(x0, best.x - coarse),
    Math.max(y0, best.y - coarse),
    Math.min(x1, best.x + coarse),
    Math.min(y1, best.y + coarse),
    1,
  );
  return best;
}

function fitScore(
  image: PixelBuffer,
  mask: AlphaMask,
  box: PixelBox,
  hp: HighpassImage,
  evalSize: number,
  radius: number,
  smooth: number,
): number {
  const { width: W, height: H } = image;
  if (evalSize > W || evalSize > H || box.size < 4) return -2;
  const cx = box.x + box.size / 2;
  const cy = box.y + box.size / 2;
  const ex = Math.max(0, Math.min(W - evalSize, Math.round(cx - evalSize / 2)));
  const ey = Math.max(0, Math.min(H - evalSize, Math.round(cy - evalSize / 2)));
  const resized = resizeMask(mask, box.size);
  const render = new Float32Array(evalSize * evalSize);
  for (let y = 0; y < box.size; y += 1) {
    const gy = box.y + y - ey;
    if (gy < 0 || gy >= evalSize) continue;
    for (let x = 0; x < box.size; x += 1) {
      const gx = box.x + x - ex;
      if (gx < 0 || gx >= evalSize) continue;
      render[gy * evalSize + gx] = resized.data[y * box.size + x];
    }
  }
  const predicted = highpass(render, evalSize, radius, smooth);
  const observed = new Float32Array(evalSize * evalSize);
  for (let y = 0; y < evalSize; y += 1) {
    for (let x = 0; x < evalSize; x += 1) {
      observed[y * evalSize + x] = hp.data[(ey + y) * W + (ex + x)];
    }
  }
  let sa = 0;
  let sb = 0;
  const n = evalSize * evalSize;
  for (let i = 0; i < n; i += 1) {
    sa += predicted[i];
    sb += observed[i];
  }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = predicted[i] - ma;
    const y = observed[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 1e-9 ? num / den : 0;
}

export function detectScaled(
  image: PixelBuffer,
  mask: AlphaMask = geminiMask(),
): PixelBox & { score: number; anchored: boolean; confident: boolean } {
  const minSide = Math.min(image.width, image.height);
  const probes = seedSizes(image.width, image.height);
  const seedEval = Math.min(minSide, Math.round(Math.max(...probes) * 1.4));
  let seed: (PixelBox & { score: number; fit: number }) | null = null;

  for (const probeRaw of probes) {
    const probe = Math.max(10, Math.min(minSide, probeRaw));
    const pRad = detailRadius(probe);
    const pSm = detailSmooth(probe);
    const pHp = highpassImage(image, pRad, pSm);
    const found = detectAtSize(image, mask, {
      size: probe,
      hp: pHp,
      radius: pRad,
      smooth: pSm,
    });
    const fit = fitScore(
      image,
      mask,
      { x: found.x, y: found.y, size: probe },
      pHp,
      seedEval,
      pRad,
      pSm,
    );
    if (!seed || fit > seed.fit) {
      seed = { x: found.x, y: found.y, size: probe, score: found.score, fit };
    }
  }

  if (!seed) {
    const fallback = defaultBox(image.width, image.height);
    return { ...fallback, score: 0, anchored: true, confident: false };
  }

  const radius = detailRadius(seed.size);
  const smooth = detailSmooth(seed.size);
  const hp = highpassImage(image, radius, smooth);
  let cur: PixelBox & { score: number } = seed;

  for (let pass = 0; pass < 2; pass += 1) {
    const cx = cur.x + cur.size / 2;
    const cy = cur.y + cur.size / 2;
    const lo = Math.max(10, Math.round(cur.size * (pass === 0 ? 0.72 : 0.9)));
    const hi = Math.min(minSide, Math.round(cur.size * (pass === 0 ? 1.4 : 1.12)));
    const evalSize = Math.min(minSide, Math.round(hi * 1.4));
    let bestSized: (PixelBox & { score: number }) | null = null;
    for (let s = lo; s <= hi; s += 1) {
      const bx = Math.max(0, Math.min(image.width - s, Math.round(cx - s / 2)));
      const by = Math.max(0, Math.min(image.height - s, Math.round(cy - s / 2)));
      const sc = fitScore(image, mask, { x: bx, y: by, size: s }, hp, evalSize, radius, smooth);
      if (!bestSized || sc > bestSized.score) {
        bestSized = { x: bx, y: by, size: s, score: sc };
      }
    }
    if (!bestSized) break;
    const half = Math.max(4, Math.round(bestSized.size * 0.5));
    const local = detectAtSize(image, mask, {
      size: bestSized.size,
      hp,
      radius,
      smooth,
      region: {
        x0: bestSized.x - half,
        y0: bestSized.y - half,
        x1: bestSized.x + half,
        y1: bestSized.y + half,
      },
    });
    const localFit = fitScore(
      image,
      mask,
      { x: local.x, y: local.y, size: bestSized.size },
      hp,
      evalSize,
      radius,
      smooth,
    );
    cur =
      localFit > bestSized.score
        ? { x: local.x, y: local.y, size: bestSized.size, score: localFit }
        : bestSized;
  }

  cur.score = detectAtSize(image, mask, {
    size: cur.size,
    hp,
    radius,
    smooth,
    region: { x0: cur.x, y0: cur.y, x1: cur.x, y1: cur.y },
  }).score;

  let anchored = false;
  const candidates = anchorBoxes(image.width, image.height);
  let anchor = candidates[0];
  let anchorScore = -2;
  for (const candidate of candidates) {
    const cRad = detailRadius(candidate.size);
    const cSm = detailSmooth(candidate.size);
    const cHp = candidate.size === cur.size ? hp : highpassImage(image, cRad, cSm);
    const sc = detectAtSize(image, mask, {
      size: candidate.size,
      hp: cHp,
      radius: cRad,
      smooth: cSm,
      region: { x0: candidate.x, y0: candidate.y, x1: candidate.x, y1: candidate.y },
    }).score;
    if (sc > anchorScore) {
      anchorScore = sc;
      anchor = candidate;
    }
  }
  if (cur.score < anchorScore + ANCHOR_MARGIN) {
    cur = { x: anchor.x, y: anchor.y, size: anchor.size, score: anchorScore };
    anchored = true;
  }

  return {
    ...cur,
    anchored,
    confident: cur.score >= MIN_DETECT_SCORE,
  };
}

export function solveGain(
  image: PixelBuffer,
  box: PixelBox,
  mask: AlphaMask,
  config: ReconstructionConfig = DEFAULT_RECONSTRUCTION,
): { gain: number; residual: number; solved: boolean; peakAlpha: number } {
  const sized = resizeMask(mask, box.size);
  const n = box.size * box.size;
  const peak = Math.max(maskPeak(sized), 1e-6);

  const residualAt = (gain: number): number => {
    const trial = new Float32Array(n);
    const touched = new Uint8Array(n);
    for (let y = 0, i = 0; y < box.size; y += 1) {
      const row = ((box.y + y) * image.width + box.x) * 4;
      for (let x = 0; x < box.size; x += 1, i += 1) {
        const p = row + x * 4;
        const a = Math.min(sized.data[i] * gain, config.blendCeiling);
        const l = luma(image.data[p], image.data[p + 1], image.data[p + 2]);
        const col = sized.overlay ? sized.overlay[i] : config.overlayLuma;
        trial[i] = a > 0 ? (l - a * col) / (1 - a) : l;
        touched[i] = a > 0 ? 1 : 0;
      }
    }
    return markResidual(sized.data, trial, box.size, touched, true);
  };

  let loG = 0.05;
  let hiG = Math.min(2.6, (config.blendCeiling / peak) * 0.999);
  const rLo = residualAt(loG);
  const rHi = residualAt(hiG);
  if (rLo <= 0) return { gain: loG, residual: rLo, solved: false, peakAlpha: peak * loG };
  if (rHi >= 0) return { gain: hiG, residual: rHi, solved: false, peakAlpha: peak * hiG };

  for (let i = 0; i < 22; i += 1) {
    const mid = 0.5 * (loG + hiG);
    if (residualAt(mid) > 0) loG = mid;
    else hiG = mid;
  }
  const gain = 0.5 * (loG + hiG);
  return { gain, residual: residualAt(gain), solved: true, peakAlpha: peak * gain };
}

export function detectWatermark(
  image: PixelBuffer,
  profileId = "google-gemini-visible",
): DetectionResult {
  const found = detectScaled(image, geminiMask());
  const region = boxToNormalized(found, image.width, image.height);
  const confidence = Math.max(0, Math.min(1, (found.score + 1) / 2));
  const detected = found.score >= MIN_DETECT_SCORE;
  const lowConfidence = detected && found.score < LOW_CONFIDENCE_SCORE;

  let message: string | null = null;
  if (!detected) {
    message = "We couldn't confidently identify a supported visible overlay.";
  } else if (lowConfidence) {
    message =
      "We found something that may be a supported watermark, but confidence is low.";
  }

  return {
    detected,
    profileId,
    confidence,
    score: found.score,
    region,
    box: { x: found.x, y: found.y, size: found.size },
    markSize: found.size,
    anchored: found.anchored,
    lowConfidence,
    message,
  };
}

export function cleanBuffer(
  image: PixelBuffer,
  box: PixelBox,
  config: ReconstructionConfig = DEFAULT_RECONSTRUCTION,
): ReconstructionStats {
  const mask = geminiMask();
  let working = config;
  let solved: { gain: number; solved: boolean } | null = null;
  if (config.opacity === "auto") {
    const result = solveGain(image, box, mask, config);
    working = { ...config, opacity: result.gain };
    solved = { gain: result.gain, solved: result.solved };
  }
  const stats = unblendRegion(image, box, mask, working);
  stats.gainSolved = solved ? solved.solved : false;
  stats.opacityUsed = typeof working.opacity === "number" ? working.opacity : 1;
  return stats;
}
