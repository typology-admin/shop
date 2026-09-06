import { HIT_ALPHA_THRESHOLD } from '../../shared/constants.ts';
import { fetchImageBlob } from './images.ts';

/** Downscale for mask extraction — keeps alpha sampling fast and dense. */
const MASK_MAX_EDGE = 192;
const SAMPLE = 2;

export type ItemFootprint = {
  /** Local coords relative to image center, in source (unscaled) pixels. */
  points: Array<{ x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const cache = new Map<string, ItemFootprint>();

export function clearFootprintCache(): void {
  cache.clear();
}

export function aabbFootprint(width: number, height: number): ItemFootprint {
  const points: Array<{ x: number; y: number }> = [];
  const left = -width / 2;
  const top = -height / 2;
  const step = Math.max(SAMPLE * 4, Math.min(width, height) / 24);
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      points.push({ x: left + x, y: top + y });
    }
  }
  return {
    points: points.length ? points : [{ x: 0, y: 0 }],
    minX: left,
    maxX: left + width,
    minY: top,
    maxY: top + height,
  };
}

export function footprintFromImageData(
  data: ImageData,
  sourceWidth: number,
  sourceHeight: number,
): ItemFootprint {
  const { width, height } = data;
  const scaleX = sourceWidth / width;
  const scaleY = sourceHeight / height;
  const points: Array<{ x: number; y: number }> = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const cx = width / 2;
  const cy = height / 2;

  // Mark solid cells, then fill spans per row so thin silhouettes stay solid.
  const solid = new Uint8Array(width * height);
  let solidCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data.data[(y * width + x) * 4 + 3] ?? 0) > HIT_ALPHA_THRESHOLD) {
        solid[y * width + x] = 1;
        solidCount += 1;
      }
    }
  }

  if (solidCount < 8) return aabbFootprint(sourceWidth, sourceHeight);

  for (let y = 0; y < height; y += 1) {
    let rowMin = -1;
    let rowMax = -1;
    for (let x = 0; x < width; x += 1) {
      if (!solid[y * width + x]) continue;
      if (rowMin < 0) rowMin = x;
      rowMax = x;
    }
    if (rowMin < 0) continue;
    for (let x = rowMin; x <= rowMax; x += SAMPLE) {
      const lx = (x + 0.5 - cx) * scaleX;
      const ly = (y + 0.5 - cy) * scaleY;
      points.push({ x: lx, y: ly });
      if (lx < minX) minX = lx;
      if (lx > maxX) maxX = lx;
      if (ly < minY) minY = ly;
      if (ly > maxY) maxY = ly;
    }
  }

  if (!points.length) return aabbFootprint(sourceWidth, sourceHeight);
  return { points, minX, maxX, minY, maxY };
}

function drawToImageData(source: CanvasImageSource, width: number, height: number): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  try {
    ctx.drawImage(source, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}

function maskSize(width: number, height: number): { w: number; h: number } {
  const scale = Math.min(1, MASK_MAX_EDGE / Math.max(width, height, 1));
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  };
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load item image.'));
    image.src = url;
  });
}

async function footprintFromBlob(blob: Blob, width: number, height: number): Promise<ItemFootprint> {
  if (!blob.type.startsWith('image/') && blob.type !== '' && blob.type !== 'application/octet-stream') {
    return aabbFootprint(width, height);
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadHtmlImage(url);
    const { w, h } = maskSize(width, height);
    const data = drawToImageData(image, w, h);
    return data ? footprintFromImageData(data, width, height) : aabbFootprint(width, height);
  } catch {
    return aabbFootprint(width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function footprintFromFile(file: Blob, width: number, height: number): Promise<ItemFootprint> {
  return footprintFromBlob(file, width, height);
}

export async function footprintForItem(imagePath: string, width: number, height: number): Promise<ItemFootprint> {
  const key = `${imagePath}:${width}x${height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let next = aabbFootprint(width, height);
  try {
    const blob = await fetchImageBlob(imagePath);
    next = await footprintFromBlob(blob, width, height);
  } catch {
    next = aabbFootprint(width, height);
  }
  cache.set(key, next);
  return next;
}
