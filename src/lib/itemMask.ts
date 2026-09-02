import { HIT_ALPHA_THRESHOLD } from '../../shared/constants.ts';
import { resolveImageUrl } from './images.ts';

const SAMPLE = 8;

export type ItemFootprint = {
  points: Array<{ x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const cache = new Map<string, ItemFootprint>();

export function aabbFootprint(width: number, height: number): ItemFootprint {
  const points: Array<{ x: number; y: number }> = [];
  const left = -width / 2;
  const top = -height / 2;
  for (let y = SAMPLE / 2; y < height; y += SAMPLE) {
    for (let x = SAMPLE / 2; x < width; x += SAMPLE) {
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

export function footprintFromImageData(data: ImageData): ItemFootprint {
  const { width, height } = data;
  const points: Array<{ x: number; y: number }> = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y += SAMPLE) {
    for (let x = 0; x < width; x += SAMPLE) {
      let solid = false;
      const yEnd = Math.min(height, y + SAMPLE);
      const xEnd = Math.min(width, x + SAMPLE);
      scan: for (let py = y; py < yEnd; py += 1) {
        for (let px = x; px < xEnd; px += 1) {
          if ((data.data[(py * width + px) * 4 + 3] ?? 0) > HIT_ALPHA_THRESHOLD) {
            solid = true;
            break scan;
          }
        }
      }
      if (!solid) continue;
      const lx = x + SAMPLE / 2 - cx;
      const ly = y + SAMPLE / 2 - cy;
      points.push({ x: lx, y: ly });
      if (lx < minX) minX = lx;
      if (lx > maxX) maxX = lx;
      if (ly < minY) minY = ly;
      if (ly > maxY) maxY = ly;
    }
  }

  if (!points.length) return aabbFootprint(width, height);
  return { points, minX, maxX, minY, maxY };
}

function drawToImageData(source: CanvasImageSource, width: number, height: number): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
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

export async function footprintFromFile(file: Blob, width: number, height: number): Promise<ItemFootprint> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadHtmlImage(url);
    const data = drawToImageData(image, width, height);
    return data ? footprintFromImageData(data) : aabbFootprint(width, height);
  } catch {
    return aabbFootprint(width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function footprintForItem(imagePath: string, width: number, height: number): Promise<ItemFootprint> {
  const key = `${imagePath}:${width}x${height}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let next = aabbFootprint(width, height);
  try {
    const url = await resolveImageUrl(imagePath);
    if (url) {
      const image = await loadHtmlImage(url);
      const data = drawToImageData(image, width, height);
      if (data) next = footprintFromImageData(data);
    }
  } catch {
    next = aabbFootprint(width, height);
  }
  cache.set(key, next);
  return next;
}
