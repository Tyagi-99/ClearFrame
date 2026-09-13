import type { PixelBuffer, PixelRect } from "./types";

function clampRect(rect: PixelRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.min(width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(width - x, Math.round(rect.width)));
  const h = Math.max(1, Math.min(height - y, Math.round(rect.height)));
  return { x, y, width: w, height: h };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function edgeDistance(x: number, y: number, area: PixelRect): number {
  return Math.min(
    x - area.x,
    area.x + area.width - 1 - x,
    y - area.y,
    area.y + area.height - 1 - y,
  );
}

function read(orig: Uint8ClampedArray, width: number, x: number, y: number): [number, number, number] {
  const p = (y * width + x) * 4;
  return [orig[p], orig[p + 1], orig[p + 2]];
}

/**
 * Continue nearby texture into the box, then blend with a wide soft edge so
 * the selection does not look like a cut-out.
 */
export function inpaintRect(buffer: PixelBuffer, rect: PixelRect): void {
  const { width, height, data } = buffer;
  const area = clampRect(rect, width, height);
  const orig = new Uint8ClampedArray(data);
  const hole = new Uint8Array(width * height);

  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      hole[y * width + x] = 1;
    }
  }

  const walkOut = (sx: number, sy: number, dx: number, dy: number): [number, number] | null => {
    let x = sx;
    let y = sy;
    for (let step = 0; step < 120; step += 1) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      if (!hole[y * width + x]) return [x, y];
    }
    return null;
  };

  const filled = new Float32Array(area.width * area.height * 3);

  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const samples: Array<[number, number, number, number]> = [];
      const dirs: Array<[number, number]> = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];
      for (const [dx, dy] of dirs) {
        const hit = walkOut(x, y, dx, dy);
        if (!hit) continue;
        const [hx, hy] = hit;
        const dist = Math.max(1, Math.abs(hx - x) + Math.abs(hy - y));
        const color = read(orig, width, hx, hy);
        samples.push([color[0], color[1], color[2], 1 / (dist * dist)]);
      }
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (const sample of samples) {
        sr += sample[0] * sample[3];
        sg += sample[1] * sample[3];
        sb += sample[2] * sample[3];
        sw += sample[3];
      }
      const o = ((y - area.y) * area.width + (x - area.x)) * 3;
      if (sw > 0) {
        filled[o] = sr / sw;
        filled[o + 1] = sg / sw;
        filled[o + 2] = sb / sw;
      } else {
        const fallback = read(orig, width, clamp(x, 0, width - 1), clamp(y, 0, height - 1));
        filled[o] = fallback[0];
        filled[o + 1] = fallback[1];
        filled[o + 2] = fallback[2];
      }
    }
  }

  const blur = new Float32Array(filled.length);
  const kx = [1, 2, 1];
  for (let y = 0; y < area.height; y += 1) {
    for (let x = 0; x < area.width; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        let w = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = clamp(y + dy, 0, area.height - 1);
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = clamp(x + dx, 0, area.width - 1);
            const ww = kx[dx + 1] * kx[dy + 1];
            sum += filled[(yy * area.width + xx) * 3 + c] * ww;
            w += ww;
          }
        }
        blur[(y * area.width + x) * 3 + c] = sum / w;
      }
    }
  }

  const feather = Math.max(14, Math.round(Math.min(area.width, area.height) * 0.28));
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      const local = ((y - area.y) * area.width + (x - area.x)) * 3;
      const p = (y * width + x) * 4;
      const alpha = smoothstep(1, feather, edgeDistance(x, y, area));
      data[p] = orig[p] * (1 - alpha) + blur[local] * alpha;
      data[p + 1] = orig[p + 1] * (1 - alpha) + blur[local + 1] * alpha;
      data[p + 2] = orig[p + 2] * (1 - alpha) + blur[local + 2] * alpha;
    }
  }
}
