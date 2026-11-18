import { HIT_ALPHA_THRESHOLD } from '../../shared/constants.ts';

/** Tiny mask — enough for click-through on transparent padding, cheap to build. */
const MASK_MAX_EDGE = 96;

type HitMask = {
  width: number;
  height: number;
  /** 1 = opaque enough to hit, 0 = miss */
  bits: Uint8Array;
};

const masks = new Map<string, HitMask | null>();
const inflight = new Map<string, Promise<HitMask | null>>();
type QueueJob = {
  key: string;
  image: HTMLImageElement;
  resolve: (mask: HitMask | null) => void;
};
const queue: QueueJob[] = [];
let draining = false;

function keyFor(path: string, revision: number) {
  return `${path}::${revision}`;
}

function buildMask(image: HTMLImageElement): HitMask | null {
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  if (srcW < 1 || srcH < 1) return null;

  const scale = Math.min(1, MASK_MAX_EDGE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }

  const bits = new Uint8Array(width * height);
  const px = data.data;
  for (let i = 0, p = 3; i < bits.length; i += 1, p += 4) {
    bits[i] = (px[p] ?? 0) >= HIT_ALPHA_THRESHOLD ? 1 : 0;
  }
  return { width, height, bits };
}

function scheduleDrain(run: () => void) {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 16);
  }
}

function drainQueue() {
  if (draining) return;
  const job = queue.shift();
  if (!job) return;
  draining = true;
  scheduleDrain(() => {
    try {
      if (!masks.has(job.key)) {
        masks.set(job.key, buildMask(job.image));
      }
      job.resolve(masks.get(job.key) ?? null);
    } catch {
      masks.set(job.key, null);
      job.resolve(null);
    } finally {
      inflight.delete(job.key);
      draining = false;
      if (queue.length) drainQueue();
    }
  });
}

/** Build once per image; serialized on idle so scroll stays responsive. */
export function ensureProductHitMask(
  imagePath: string,
  revision: number,
  image: HTMLImageElement,
): Promise<HitMask | null> {
  const key = keyFor(imagePath, revision);
  if (masks.has(key)) return Promise.resolve(masks.get(key) ?? null);
  const pending = inflight.get(key);
  if (pending) return pending;

  const work = new Promise<HitMask | null>((resolve) => {
    queue.push({ key, image, resolve });
    drainQueue();
  });
  inflight.set(key, work);
  return work;
}

export function peekProductHitMask(imagePath: string, revision = 0): HitMask | null {
  return masks.get(keyFor(imagePath, revision)) ?? null;
}

/**
 * Sample mask in item-local center space (unscaled source pixels).
 * `localX`/`localY` are relative to the image center.
 */
export function hitMaskContains(
  mask: HitMask,
  localX: number,
  localY: number,
  imageWidth: number,
  imageHeight: number,
): boolean {
  const u = (localX + imageWidth / 2) / imageWidth;
  const v = (localY + imageHeight / 2) / imageHeight;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
  const x = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)));
  return mask.bits[y * mask.width + x] === 1;
}

/** World point → item-local center space (accounts for rotation + scale). */
export function worldToItemLocal(
  worldX: number,
  worldY: number,
  itemX: number,
  itemY: number,
  scale: number,
  rotationDeg: number,
): { x: number; y: number } {
  const dx = worldX - itemX;
  const dy = worldY - itemY;
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = (dx * cos - dy * sin) / scale;
  const ly = (dx * sin + dy * cos) / scale;
  return { x: lx, y: ly };
}

export function forgetProductHitMask(imagePath: string, revision = 0): void {
  const key = keyFor(imagePath, revision);
  masks.delete(key);
  inflight.delete(key);
}
