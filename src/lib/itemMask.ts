import { fetchImageBlob } from './images.ts';

/** Downscale for mask extraction — keeps alpha sampling fast and dense. */
const MASK_MAX_EDGE = 192;
const SAMPLE = 1;
const MAX_HULL = 24;
/** Include soft cutout fringes so packing doesn't sit inside visible edges. */
const PACK_ALPHA_THRESHOLD = 4;
/** Expand solid mask by this many mask pixels before building the hull. */
const MASK_DILATE = 1;
const CACHE_VERSION = 'v2';

export type ItemFootprint = {
  /** Local coords relative to image center, in source (unscaled) pixels. */
  points: Array<{ x: number; y: number }>;
  /** Convex hull of visible pixels (same local space). */
  hull: Array<{ x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const cache = new Map<string, ItemFootprint>();

export function clearFootprintCache(): void {
  cache.clear();
}

function cross(
  o: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Andrew's monotone chain; returns CCW hull. */
export function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length <= 2) return points.slice();
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Array<{ x: number; y: number }> = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Array<{ x: number; y: number }> = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  if (hull.length <= MAX_HULL) return hull;
  // Keep silhouette extent while capping SAT cost.
  const step = hull.length / MAX_HULL;
  const simplified: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < MAX_HULL; i += 1) {
    simplified.push(hull[Math.min(hull.length - 1, Math.floor(i * step))]!);
  }
  return simplified;
}

function rectHull(width: number, height: number): Array<{ x: number; y: number }> {
  const left = -width / 2;
  const top = -height / 2;
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
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
    hull: rectHull(width, height),
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

  const solid = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data.data[(y * width + x) * 4 + 3] ?? 0) > PACK_ALPHA_THRESHOLD) {
        solid[y * width + x] = 1;
      }
    }
  }

  // Dilate so feathered / anti-aliased edges stay inside the collision hull.
  let marked = solid;
  if (MASK_DILATE > 0) {
    const next = solid.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!solid[y * width + x]) continue;
        for (let dy = -MASK_DILATE; dy <= MASK_DILATE; dy += 1) {
          for (let dx = -MASK_DILATE; dx <= MASK_DILATE; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            next[ny * width + nx] = 1;
          }
        }
      }
    }
    marked = next;
  }

  for (let y = 0; y < height; y += SAMPLE) {
    for (let x = 0; x < width; x += SAMPLE) {
      if (!marked[y * width + x]) continue;
      const lx = (x + 0.5 - cx) * scaleX;
      const ly = (y + 0.5 - cy) * scaleY;
      points.push({ x: lx, y: ly });
      if (lx < minX) minX = lx;
      if (lx > maxX) maxX = lx;
      if (ly < minY) minY = ly;
      if (ly > maxY) maxY = ly;
    }
  }

  if (points.length < 8) return aabbFootprint(sourceWidth, sourceHeight);
  const hull = convexHull(points);
  return {
    points,
    hull: hull.length >= 3 ? hull : rectHull(sourceWidth, sourceHeight),
    minX,
    maxX,
    minY,
    maxY,
  };
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
  const key = `${CACHE_VERSION}:${imagePath}:${width}x${height}`;
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

export function forgetFootprint(imagePath: string): void {
  for (const key of cache.keys()) {
    if (key.includes(`:${imagePath}:`)) cache.delete(key);
  }
}
