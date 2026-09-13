import { inpaintRect } from "./inpaint";
import type { PixelBuffer, PixelRect } from "./types";

export const LAMA_INPUT_SIZE = 512;
export const ROI_EXPAND = 0.5;
export const MASK_DILATE_PX = 3;
export const COMPOSITE_FEATHER_PX = 10;
export const LAMA_MODEL_URL =
  "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx";
export const LAMA_LOCAL_URL = "/models/lama_fp32.onnx";
export const LAMA_CACHE_NAME = "clearframe-lama-v1";

export type LetterboxMapping = {
  crop: PixelRect;
  size: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  scaledWidth: number;
  scaledHeight: number;
};

export type LamaPrep = {
  image: Float32Array;
  mask: Float32Array;
  mapping: LetterboxMapping;
};

export type LamaRunner = {
  run(image: Float32Array, mask: Float32Array): Promise<Float32Array>;
};

export type LamaProgress = (ratio: number, message: string) => void;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function clampRect(rect: PixelRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.min(width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(width - x, Math.round(rect.width)));
  const h = Math.max(1, Math.min(height - y, Math.round(rect.height)));
  return { x, y, width: w, height: h };
}

export function expandRect(
  rect: PixelRect,
  width: number,
  height: number,
  factor = ROI_EXPAND,
): PixelRect {
  const extraW = rect.width * factor;
  const extraH = rect.height * factor;
  return clampRect(
    {
      x: rect.x - extraW / 2,
      y: rect.y - extraH / 2,
      width: rect.width + extraW,
      height: rect.height + extraH,
    },
    width,
    height,
  );
}

function edgeDistance(x: number, y: number, area: PixelRect): number {
  return Math.min(
    x - area.x,
    area.x + area.width - 1 - x,
    y - area.y,
    area.y + area.height - 1 - y,
  );
}

function sampleSource(
  source: PixelBuffer,
  x: number,
  y: number,
): [number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;
  const c00 = clampedPixel(source, x0, y0);
  const c10 = clampedPixel(source, x1, y0);
  const c01 = clampedPixel(source, x0, y1);
  const c11 = clampedPixel(source, x1, y1);
  return [
    c00[0] * (1 - fx) * (1 - fy) + c10[0] * fx * (1 - fy) + c01[0] * (1 - fx) * fy + c11[0] * fx * fy,
    c00[1] * (1 - fx) * (1 - fy) + c10[1] * fx * (1 - fy) + c01[1] * (1 - fx) * fy + c11[1] * fx * fy,
    c00[2] * (1 - fx) * (1 - fy) + c10[2] * fx * (1 - fy) + c01[2] * (1 - fx) * fy + c11[2] * fx * fy,
  ];
}

function clampedPixel(
  source: PixelBuffer,
  x: number,
  y: number,
): [number, number, number] {
  const xx = clamp(x, 0, source.width - 1);
  const yy = clamp(y, 0, source.height - 1);
  const i = (yy * source.width + xx) * 4;
  return [source.data[i], source.data[i + 1], source.data[i + 2]];
}

function sourceToTensor(
  mapping: LetterboxMapping,
  x: number,
  y: number,
): { tx: number; ty: number } {
  return {
    tx: mapping.offsetX + (x - mapping.crop.x + 0.5) * mapping.scale - 0.5,
    ty: mapping.offsetY + (y - mapping.crop.y + 0.5) * mapping.scale - 0.5,
  };
}

function tensorToSource(
  mapping: LetterboxMapping,
  tx: number,
  ty: number,
): { x: number; y: number } {
  return {
    x: mapping.crop.x + (tx - mapping.offsetX + 0.5) / mapping.scale - 0.5,
    y: mapping.crop.y + (ty - mapping.offsetY + 0.5) / mapping.scale - 0.5,
  };
}

export function prepareLamaInputs(source: PixelBuffer, hole: PixelRect): LamaPrep {
  const crop = expandRect(hole, source.width, source.height);
  const scale = LAMA_INPUT_SIZE / Math.max(crop.width, crop.height);
  const scaledWidth = Math.max(1, Math.round(crop.width * scale));
  const scaledHeight = Math.max(1, Math.round(crop.height * scale));
  const mapping: LetterboxMapping = {
    crop,
    size: LAMA_INPUT_SIZE,
    scale,
    offsetX: Math.floor((LAMA_INPUT_SIZE - scaledWidth) / 2),
    offsetY: Math.floor((LAMA_INPUT_SIZE - scaledHeight) / 2),
    scaledWidth,
    scaledHeight,
  };

  const plane = LAMA_INPUT_SIZE * LAMA_INPUT_SIZE;
  const image = new Float32Array(3 * plane);
  for (let ty = 0; ty < LAMA_INPUT_SIZE; ty += 1) {
    for (let tx = 0; tx < LAMA_INPUT_SIZE; tx += 1) {
      const src = tensorToSource(mapping, tx, ty);
      const rgb = sampleSource(source, src.x, src.y);
      const idx = ty * LAMA_INPUT_SIZE + tx;
      image[idx] = rgb[0] / 255;
      image[plane + idx] = rgb[1] / 255;
      image[plane * 2 + idx] = rgb[2] / 255;
    }
  }

  return {
    image,
    mask: buildMaskTensor(hole, mapping, MASK_DILATE_PX),
    mapping,
  };
}

export function buildMaskTensor(
  hole: PixelRect,
  mapping: LetterboxMapping,
  dilatePx: number,
): Float32Array {
  const size = mapping.size;
  const mask = new Float32Array(size * size);
  for (let ty = 0; ty < size; ty += 1) {
    for (let tx = 0; tx < size; tx += 1) {
      const src = tensorToSource(mapping, tx, ty);
      if (
        src.x >= hole.x &&
        src.x < hole.x + hole.width &&
        src.y >= hole.y &&
        src.y < hole.y + hole.height
      ) {
        mask[ty * size + tx] = 1;
      }
    }
  }
  if (dilatePx <= 0) return mask;

  const dilated = new Float32Array(mask);
  const radius = Math.round(dilatePx);
  for (let ty = 0; ty < size; ty += 1) {
    for (let tx = 0; tx < size; tx += 1) {
      if (mask[ty * size + tx] < 1) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = tx + dx;
          const yy = ty + dy;
          if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
          dilated[yy * size + xx] = 1;
        }
      }
    }
  }
  return dilated;
}

function featherFor(hole: PixelRect, requested: number): number {
  const cap = Math.max(2, Math.floor(Math.min(hole.width, hole.height) / 3));
  return Math.min(requested, cap);
}

function sampleOutput(
  output: Float32Array,
  mapping: LetterboxMapping,
  x: number,
  y: number,
): [number, number, number] {
  const { tx, ty } = sourceToTensor(mapping, x, y);
  const size = mapping.size;
  const plane = size * size;
  const x0 = Math.floor(tx);
  const y0 = Math.floor(ty);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = tx - x0;
  const fy = ty - y0;
  const at = (c: number, px: number, py: number) => {
    const xx = clamp(px, 0, size - 1);
    const yy = clamp(py, 0, size - 1);
    return output[c * plane + yy * size + xx];
  };
  const channel = (c: number) =>
    at(c, x0, y0) * (1 - fx) * (1 - fy) +
    at(c, x1, y0) * fx * (1 - fy) +
    at(c, x0, y1) * (1 - fx) * fy +
    at(c, x1, y1) * fx * fy;
  return [channel(0), channel(1), channel(2)];
}

export function compositeLamaOutput(
  target: PixelBuffer,
  output: Float32Array,
  hole: PixelRect,
  mapping: LetterboxMapping,
  featherPx = COMPOSITE_FEATHER_PX,
): void {
  const feather = featherFor(hole, featherPx);
  const pad = Math.max(1, Math.round(feather));
  const area = clampRect(
    {
      x: hole.x - pad,
      y: hole.y - pad,
      width: hole.width + pad * 2,
      height: hole.height + pad * 2,
    },
    target.width,
    target.height,
  );

  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const dist = edgeDistance(x, y, hole);
      const alpha = dist >= 0 ? 1 : smoothstep(-feather, 0, dist);
      if (alpha <= 0) continue;
      const filled = sampleOutput(output, mapping, x, y);
      const i = (y * target.width + x) * 4;
      target.data[i] = target.data[i] * (1 - alpha) + filled[0] * alpha;
      target.data[i + 1] = target.data[i + 1] * (1 - alpha) + filled[1] * alpha;
      target.data[i + 2] = target.data[i + 2] * (1 - alpha) + filled[2] * alpha;
    }
  }
}

export async function inpaintWithLama(
  buffer: PixelBuffer,
  hole: PixelRect,
  options: { runner?: LamaRunner; onProgress?: LamaProgress } = {},
): Promise<{ fallback: boolean }> {
  let runner: LamaRunner;
  try {
    runner = options.runner ?? (await getLamaRunner(options.onProgress));
  } catch {
    inpaintRect(buffer, hole);
    return { fallback: true };
  }

  try {
    const prep = prepareLamaInputs(buffer, hole);
    const output = await runner.run(prep.image, prep.mask);
    compositeLamaOutput(buffer, output, hole, prep.mapping, COMPOSITE_FEATHER_PX);
    return { fallback: false };
  } catch {
    inpaintRect(buffer, hole);
    return { fallback: true };
  }
}

let sharedRunner: LamaRunner | null = null;
let loadPromise: Promise<LamaRunner> | null = null;

export async function getLamaRunner(onProgress?: LamaProgress): Promise<LamaRunner> {
  if (sharedRunner) return sharedRunner;
  if (!loadPromise) {
    loadPromise = createOrtRunner(onProgress)
      .then((runner) => {
        sharedRunner = runner;
        return runner;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

async function createOrtRunner(onProgress?: LamaProgress): Promise<LamaRunner> {
  onProgress?.(0.02, "Loading fill model…");
  const model = await loadModelBytes(onProgress);
  onProgress?.(0.38, "Loading fill model…");

  const wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/";

  const webgpu = await import("onnxruntime-web/webgpu").catch(() => null);
  if (webgpu) {
    webgpu.env.wasm.wasmPaths = wasmPaths;
    webgpu.env.wasm.numThreads = 1;
    webgpu.env.wasm.simd = true;
    try {
      const session = await webgpu.InferenceSession.create(model, {
        executionProviders: ["webgpu"],
      });
      onProgress?.(0.48, "Loading fill model…");
      return makeOrtRunner(webgpu, session);
    } catch {
      // Custom Fourier ops may not run on WebGPU; WASM still works.
    }
  }

  const wasm = await import("onnxruntime-web/wasm");
  wasm.env.wasm.wasmPaths = wasmPaths;
  wasm.env.wasm.numThreads = 1;
  wasm.env.wasm.simd = true;
  const session = await wasm.InferenceSession.create(model, {
    executionProviders: ["wasm"],
  });
  onProgress?.(0.48, "Loading fill model…");
  return makeOrtRunner(wasm, session);
}

function makeOrtRunner(
  ort: typeof import("onnxruntime-web/wasm"),
  session: import("onnxruntime-web").InferenceSession,
): LamaRunner {
  return {
    async run(image, mask) {
      const imageTensor = new ort.Tensor("float32", image, [
        1,
        3,
        LAMA_INPUT_SIZE,
        LAMA_INPUT_SIZE,
      ]);
      const maskTensor = new ort.Tensor("float32", mask, [
        1,
        1,
        LAMA_INPUT_SIZE,
        LAMA_INPUT_SIZE,
      ]);
      const results = await session.run({ image: imageTensor, mask: maskTensor });
      const first = results[session.outputNames[0]];
      return first.data as Float32Array;
    },
  };
}

async function loadModelBytes(onProgress?: LamaProgress): Promise<ArrayBuffer> {
  if (typeof caches !== "undefined") {
    const cache = await caches.open(LAMA_CACHE_NAME);
    const hit =
      (await cache.match(LAMA_LOCAL_URL)) ?? (await cache.match(LAMA_MODEL_URL));
    if (hit) {
      onProgress?.(0.32, "Loading fill model…");
      return hit.arrayBuffer();
    }
  }

  let lastError: unknown;
  for (const url of [LAMA_LOCAL_URL, LAMA_MODEL_URL]) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Could not load the fill model (${response.status}).`);
        continue;
      }
      const buffer = await readBodyProgress(response, onProgress);
      if (typeof caches !== "undefined") {
        try {
          const cache = await caches.open(LAMA_CACHE_NAME);
          await cache.put(
            url,
            new Response(buffer.slice(0), {
              headers: { "Content-Type": "application/octet-stream" },
            }),
          );
        } catch {
          // Cache quota is optional; inference can still run from memory.
        }
      }
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load the fill model.");
}

async function readBodyProgress(
  response: Response,
  onProgress?: LamaProgress,
): Promise<ArrayBuffer> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (!response.body) return response.arrayBuffer();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (length > 0) {
      onProgress?.(0.04 + 0.3 * (received / length), "Loading fill model…");
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}
