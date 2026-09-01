const MAX_EDGE = 2400;
const BG_TOLERANCE = 46;
const HOLE_TOLERANCE = 16;
const FEATHER = 28;

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
};

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
  const light = samples.filter((s) => s.lum >= 210);
  const used = light.length >= 3 ? light : samples;
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

function removeWhiteBackground(image: ImageData): ImageData {
  const { width, height, data } = image;
  const bg = sampleBackground(data, width, height);
  const marked = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const consider = (x: number, y: number) => {
    const idx = y * width + x;
    if (marked[idx]) return;
    const i = idx * 4;
    const dist = colorDist(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, bg.r, bg.g, bg.b);
    if (dist <= BG_TOLERANCE) {
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
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const dist = colorDist(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, bg.r, bg.g, bg.b);
      if (dist <= HOLE_TOLERANCE) marked[p] = 1;
    }
  }

  const next = new Uint8ClampedArray(data);
  for (let p = 0; p < marked.length; p += 1) {
    if (marked[p]) next[p * 4 + 3] = 0;
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
      const dist = colorDist(next[i] ?? 0, next[i + 1] ?? 0, next[i + 2] ?? 0, bg.r, bg.g, bg.b);
      if (dist >= FEATHER) continue;
      next[i + 3] = Math.max(0, Math.min(255, Math.round((255 * dist) / FEATHER)));
    }
  }

  let remaining = 0;
  for (let i = 3; i < next.length; i += 4) {
    if ((next[i] ?? 0) > 16) remaining += 1;
  }
  if (remaining < 24) {
    throw new Error('Could not cut the object from a light background. Try a product photo on white.');
  }

  return new ImageData(next, width, height);
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

export async function prepareItemImage(source: Blob, name = 'item.png'): Promise<PreparedImage> {
  let image = await decodeImage(source);
  if (!hasSeeThrough(image.data)) {
    image = removeWhiteBackground(image);
  }
  image = cropToAlpha(image);
  const blob = await encodePng(image);
  const fileName = name.replace(/\.[a-z0-9]+$/i, '') + '.png';
  return {
    file: new File([blob], fileName, { type: 'image/png' }),
    width: image.width,
    height: image.height,
  };
}
