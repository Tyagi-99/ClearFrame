import type { PixelBuffer } from "./types";

export function createBuffer(
  width: number,
  height: number,
  fill: [number, number, number, number] = [0, 0, 0, 255],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return { width, height, data };
}

export function cloneBuffer(source: PixelBuffer): PixelBuffer {
  return {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data),
  };
}

export function pixelIndex(buffer: PixelBuffer, x: number, y: number): number {
  return (y * buffer.width + x) * 4;
}

export function getPixel(
  buffer: PixelBuffer,
  x: number,
  y: number,
): [number, number, number, number] {
  const i = pixelIndex(buffer, x, y);
  return [buffer.data[i], buffer.data[i + 1], buffer.data[i + 2], buffer.data[i + 3]];
}

export function setPixel(
  buffer: PixelBuffer,
  x: number,
  y: number,
  pixel: [number, number, number, number],
): void {
  const i = pixelIndex(buffer, x, y);
  buffer.data[i] = pixel[0];
  buffer.data[i + 1] = pixel[1];
  buffer.data[i + 2] = pixel[2];
  buffer.data[i + 3] = pixel[3];
}

export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function bufferFromImageData(image: ImageData): PixelBuffer {
  return {
    width: image.width,
    height: image.height,
    data: image.data,
  };
}
