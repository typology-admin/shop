const MAX_EDGE = 2400;
export const DEFAULT_BG_TOLERANCE = 46;
export const MIN_BG_TOLERANCE = 4;
export const MAX_BG_TOLERANCE = 110;
const HOLE_RATIO = 16 / 46;
const FEATHER_RATIO = 28 / 46;

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
};

export type CutoutSession = {
  name: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  sourceAlpha: Uint8ClampedArray;
  alpha: Uint8ClampedArray;
  tolerance: number;
  canAuto: boolean;
};

export type CutoutBrush = 'keep' | 'cut';

function colorDist(r: number, g: number, b: number, br: number, bg: number, bb: number): number {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleBackground(data: Uint8ClampedArray, width: number, height: number) {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
  ];
  const samples: Array<{ r: number; g: number; b: number; lum: number }> = [];
  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    samples.push({ r, g, b, lum: (r + g + b) / 3 });
  }
  // Prefer bright / studio greys; fall back to the lightest cluster of edge samples.
  const studio = samples.filter((s) => s.lum >= 165);
  let used = studio.length >= 3 ? studio : samples;
  const sorted = [...used].sort((a, b) => a.lum - b.lum);
  const mid = sorted[Math.floor(sorted.length / 2)]?.lum ?? 220;
  const clustered = used.filter((s) => Math.abs(s.lum - mid) <= 28);
  if (clustered.length >= 3) used = clustered;
  const n = used.length || 1;
  return {
    r: Math.round(used.reduce((sum, s) => sum + s.r, 0) / n),
    g: Math.round(used.reduce((sum, s) => sum + s.g, 0) / n),
    b: Math.round(used.reduce((sum, s) => sum + s.b, 0) / n),
  };
}

function hasSeeThrough(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 255) < 128) return true;
  }
  return false;
}

function copyAlpha(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(width * height);
  for (let p = 0; p < alpha.length; p += 1) {
    alpha[p] = data[p * 4 + 3] ?? 255;
  }
  return alpha;
}

function autoAlpha(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sourceAlpha: Uint8ClampedArray,
  tolerance: number,
): Uint8ClampedArray {
  const hole = Math.max(8, Math.round(tolerance * HOLE_RATIO));
  const feather = Math.max(12, Math.round(tolerance * FEATHER_RATIO));
  const bg = sampleBackground(pixels, width, height);
  const marked = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const consider = (x: number, y: number) => {
    const idx = y * width + x;
    if (marked[idx]) return;
    const i = idx * 4;
    const dist = colorDist(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, bg.r, bg.g, bg.b);
    if (dist <= tolerance) {
      marked[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x += 1) {
    consider(x, 0);
    consider(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    consider(0, y);
    consider(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++] ?? 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) consider(x - 1, y);
    if (x + 1 < width) consider(x + 1, y);
    if (y > 0) consider(x, y - 1);
    if (y + 1 < height) consider(x, y + 1);
  }

  let bgCount = 0;
  for (let i = 0; i < marked.length; i += 1) {
    if (marked[i]) bgCount += 1;
  }
  if (bgCount / marked.length < 0.02) {
    for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      const dist = colorDist(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, bg.r, bg.g, bg.b);
      if (dist <= hole) marked[p] = 1;
    }
  }

  const alpha = new Uint8ClampedArray(width * height);
  for (let p = 0; p < marked.length; p += 1) {
    alpha[p] = marked[p] ? 0 : (sourceAlpha[p] ?? 255);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (marked[p]) continue;
      const nearBg =
        (x > 0 && marked[p - 1]) ||
        (x + 1 < width && marked[p + 1]) ||
        (y > 0 && marked[p - width]) ||
        (y + 1 < height && marked[p + width]);
      if (!nearBg) continue;
      const i = p * 4;
      const dist = colorDist(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, bg.r, bg.g, bg.b);
      if (dist >= feather) continue;
      const source = sourceAlpha[p] ?? 255;
      alpha[p] = Math.max(0, Math.min(255, Math.round((source * dist) / feather)));
    }
  }

  let remaining = 0;
  for (let p = 0; p < alpha.length; p += 1) {
    if ((alpha[p] ?? 0) > 16) remaining += 1;
  }
  // Grey studio shots can wipe the subject; keep the original so the editor still opens.
  if (remaining < 24) return sourceAlpha.slice();

  return alpha;
}

export function compositeCutout(session: CutoutSession): ImageData {
  const data = new Uint8ClampedArray(session.pixels);
  for (let p = 0; p < session.alpha.length; p += 1) {
    data[p * 4 + 3] = session.alpha[p] ?? 0;
  }
  return new ImageData(data, session.width, session.height);
}

export function applyAutoCutout(session: CutoutSession, tolerance = session.tolerance): void {
  session.tolerance = Math.max(MIN_BG_TOLERANCE, Math.min(MAX_BG_TOLERANCE, tolerance));
  try {
    session.alpha = autoAlpha(
      session.pixels,
      session.width,
      session.height,
      session.sourceAlpha,
      session.tolerance,
    );
  } catch {
    session.alpha = session.sourceAlpha.slice();
  }
}

export function resetCutout(session: CutoutSession): void {
  if (session.canAuto) applyAutoCutout(session, session.tolerance);
  else session.alpha = session.sourceAlpha.slice();
}

export function paintCutout(
  session: CutoutSession,
  cx: number,
  cy: number,
  radius: number,
  mode: CutoutBrush,
): { x: number; y: number; w: number; h: number } {
  const { width, height, alpha } = session;
  const rad = Math.max(1, radius);
  const minX = Math.max(0, Math.floor(cx - rad));
  const maxX = Math.min(width - 1, Math.ceil(cx + rad));
  const minY = Math.max(0, Math.floor(cy - rad));
  const maxY = Math.min(height - 1, Math.ceil(cy + rad));
  const r2 = rad * rad;

  for (let y = minY; y <= maxY; y += 1) {
    const dy = y + 0.5 - cy;
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / rad;
      const falloff = t * t;
      const p = y * width + x;
      const current = alpha[p] ?? 0;
      if (mode === 'cut') {
        alpha[p] = Math.round(current * (1 - falloff));
      } else {
        alpha[p] = Math.round(current + (255 - current) * falloff);
      }
    }
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Punch an enclosed leftover background (ring hole, leash loop) from a seed point. */
export function floodCutAt(
  session: CutoutSession,
  sx: number,
  sy: number,
  tolerance = DEFAULT_BG_TOLERANCE,
): boolean {
  const { width, height, pixels, alpha } = session;
  const startX = Math.max(0, Math.min(width - 1, Math.round(sx)));
  const startY = Math.max(0, Math.min(height - 1, Math.round(sy)));
  const start = startY * width + startX;
  if ((alpha[start] ?? 0) < 16) return false;

  const si = start * 4;
  const br = pixels[si] ?? 0;
  const bg = pixels[si + 1] ?? 0;
  const bb = pixels[si + 2] ?? 0;
  const marked = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  marked[start] = 1;
  queue[tail++] = start;

  while (head < tail) {
    const idx = queue[head++] ?? 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x + 1 < width ? idx + 1 : -1,
      y > 0 ? idx - width : -1,
      y + 1 < height ? idx + width : -1,
    ];
    for (const next of neighbors) {
      if (next < 0 || marked[next]) continue;
      if ((alpha[next] ?? 0) < 16) continue;
      const i = next * 4;
      if (colorDist(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, br, bg, bb) > tolerance) {
        continue;
      }
      marked[next] = 1;
      queue[tail++] = next;
    }
  }

  if (tail < 8) return false;
  // Don't wipe most of the object if the click landed on the product itself.
  let opaque = 0;
  for (let p = 0; p < alpha.length; p += 1) {
    if ((alpha[p] ?? 0) > 16) opaque += 1;
  }
  if (tail > opaque * 0.45) return false;

  for (let p = 0; p < marked.length; p += 1) {
    if (marked[p]) alpha[p] = 0;
  }
  return true;
}

function cropToAlpha(image: ImageData): ImageData {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) <= 8) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error('That image has no visible pixels after cutout.');
  }
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const next = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const src = ((minY + y) * width + minX) * 4;
    next.set(data.subarray(src, src + w * 4), y * w * 4);
  }
  return new ImageData(next, w, h);
}

async function decodeImage(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not read the image in this browser.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}

function encodePng(image: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Could not write the PNG.'));
  ctx.putImageData(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the PNG.'));
    }, 'image/png');
  });
}

export async function beginCutout(source: Blob, name = 'item.png'): Promise<CutoutSession> {
  const image = await decodeImage(source);
  const sourceAlpha = copyAlpha(image.data, image.width, image.height);
  const canAuto = !hasSeeThrough(image.data);
  const session: CutoutSession = {
    name,
    width: image.width,
    height: image.height,
    pixels: new Uint8ClampedArray(image.data),
    sourceAlpha,
    alpha: sourceAlpha.slice(),
    tolerance: DEFAULT_BG_TOLERANCE,
    canAuto,
  };
  if (canAuto) {
    try {
      applyAutoCutout(session, DEFAULT_BG_TOLERANCE);
    } catch {
      session.alpha = sourceAlpha.slice();
    }
  }
  return session;
}

export async function finalizeCutout(session: CutoutSession): Promise<PreparedImage> {
  const image = cropToAlpha(compositeCutout(session));
  const blob = await encodePng(image);
  const fileName = session.name.replace(/\.[a-z0-9]+$/i, '') + '.png';
  return {
    file: new File([blob], fileName, { type: 'image/png' }),
    width: image.width,
    height: image.height,
  };
}

export async function prepareItemImage(source: Blob, name = 'item.png'): Promise<PreparedImage> {
  const session = await beginCutout(source, name);
  return finalizeCutout(session);
}
