const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export type PngInfo = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  hasAlphaChannel: boolean;
  hasTransparencyChunk: boolean;
};

type PngBody = {
  info: PngInfo;
  interlace: number;
  idat: Uint8Array;
  plte: Uint8Array | null;
  trns: Uint8Array | null;
};

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function concatChunks(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function sampleChannels(colorType: number): number {
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  return 1;
}

function readPngBody(bytes: Uint8Array): PngBody {
  if (bytes.length < 33) {
    throw new Error('File is too small to be a PNG.');
  }

  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a PNG file. Export a transparent PNG and try again.');
    }
  }

  const ihdrLength = readU32(bytes, 8);
  if (chunkType(bytes, 12) !== 'IHDR' || ihdrLength < 13) {
    throw new Error('Invalid PNG: missing IHDR chunk.');
  }

  const width = readU32(bytes, 16);
  const height = readU32(bytes, 20);
  const bitDepth = bytes[24] ?? 0;
  const colorType = bytes[25] ?? 0;
  const interlace = bytes[28] ?? 0;

  if (width < 1 || height < 1) {
    throw new Error('Invalid PNG dimensions.');
  }

  const idatParts: Uint8Array[] = [];
  let plte: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  let offset = 8 + 12 + ihdrLength;
  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset);
    const next = offset + 12 + length;
    if (next > bytes.length) {
      throw new Error('Invalid PNG: truncated chunk.');
    }
    const type = chunkType(bytes, offset + 4);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idatParts.push(data);
    if (type === 'PLTE') plte = data.slice();
    if (type === 'tRNS') trns = data.slice();
    if (type === 'IEND') break;
    offset = next;
  }

  if (idatParts.length === 0) {
    throw new Error('Invalid PNG: missing image data.');
  }

  return {
    info: {
      width,
      height,
      bitDepth,
      colorType,
      hasAlphaChannel: colorType === 4 || colorType === 6,
      hasTransparencyChunk: trns !== null,
    },
    interlace,
    idat: concatChunks(idatParts),
    plte,
    trns,
  };
}

export function parsePng(bytes: Uint8Array): PngInfo {
  return readPngBody(bytes).info;
}

export function assertPngCanBeTransparent(info: PngInfo): void {
  if (!info.hasAlphaChannel && !info.hasTransparencyChunk) {
    throw new Error(
      'This PNG is fully opaque (no alpha channel). Export it on a transparent background so empty pixels stay click-through.',
    );
  }
}

export function bufferHasSeeThroughPixel(data: ArrayLike<number>): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 255) < 128) return true;
  }
  return false;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const copy = data.slice();
  const tryFormat = async (format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> => {
    const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };

  try {
    return await tryFormat('deflate');
  } catch {
    return await tryFormat('deflate-raw');
  }
}

function unfilter(
  inflated: Uint8Array,
  width: number,
  height: number,
  colorType: number,
  bitDepth: number,
): Uint8Array {
  const channels = sampleChannels(colorType);
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const expected = height * (1 + rowBytes);
  if (inflated.length < expected) {
    throw new Error('Invalid PNG: image data is truncated.');
  }

  const out = new Uint8Array(height * rowBytes);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src] ?? 0;
    src += 1;
    const dest = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[src] ?? 0;
      src += 1;
      const left = x >= bpp ? (out[dest + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (out[dest + x - rowBytes] ?? 0) : 0;
      const upLeft = y > 0 && x >= bpp ? (out[dest + x - rowBytes - bpp] ?? 0) : 0;
      let recon = raw;
      if (filter === 1) recon = raw + left;
      else if (filter === 2) recon = raw + up;
      else if (filter === 3) recon = raw + Math.floor((left + up) / 2);
      else if (filter === 4) recon = raw + paeth(left, up, upLeft);
      else if (filter !== 0) {
        throw new Error('Invalid PNG: unknown filter type.');
      }
      out[dest + x] = recon & 255;
    }
  }
  return out;
}

function samplesAreSeeThrough(
  samples: Uint8Array,
  body: PngBody,
): boolean {
  const { width, height, bitDepth, colorType } = body.info;
  const { plte, trns } = body;

  if (bitDepth === 8 && colorType === 6) {
    return bufferHasSeeThroughPixel(samples);
  }

  if (bitDepth === 8 && colorType === 4) {
    for (let i = 1; i < samples.length; i += 2) {
      if ((samples[i] ?? 255) < 128) return true;
    }
    return false;
  }

  if (bitDepth === 16 && colorType === 6) {
    for (let i = 6; i < samples.length; i += 8) {
      const alpha = ((samples[i] ?? 255) << 8) | (samples[i + 1] ?? 255);
      if (alpha < 32896) return true;
    }
    return false;
  }

  if (bitDepth === 16 && colorType === 4) {
    for (let i = 2; i < samples.length; i += 4) {
      const alpha = ((samples[i] ?? 255) << 8) | (samples[i + 1] ?? 255);
      if (alpha < 32896) return true;
    }
    return false;
  }

  if (bitDepth === 8 && colorType === 2 && trns && trns.length >= 6) {
    const r = Math.floor(readU16(trns, 0) / 257);
    const g = Math.floor(readU16(trns, 2) / 257);
    const b = Math.floor(readU16(trns, 4) / 257);
    for (let i = 0; i + 2 < samples.length; i += 3) {
      if (samples[i] === r && samples[i + 1] === g && samples[i + 2] === b) return true;
    }
    return false;
  }

  if (bitDepth === 8 && colorType === 0 && trns && trns.length >= 2) {
    const gray = Math.floor(readU16(trns, 0) / 257);
    for (let i = 0; i < samples.length; i += 1) {
      if (samples[i] === gray) return true;
    }
    return false;
  }

  if (colorType === 3 && trns && plte) {
    const rowBytes = Math.ceil((width * bitDepth) / 8);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const bitIndex = y * rowBytes * 8 + x * bitDepth;
        const byteIndex = bitIndex >> 3;
        const shift = 8 - bitDepth - (bitIndex & 7);
        const mask = (1 << bitDepth) - 1;
        const index = ((samples[byteIndex] ?? 0) >> shift) & mask;
        if ((trns[index] ?? 255) < 128) return true;
      }
    }
    return false;
  }

  return body.info.hasAlphaChannel || body.info.hasTransparencyChunk;
}

export async function pngHasSeeThroughPixel(bytes: Uint8Array): Promise<boolean> {
  const body = readPngBody(bytes);
  if (body.interlace !== 0) {
    return body.info.hasAlphaChannel || body.info.hasTransparencyChunk;
  }

  const samples = unfilter(
    await inflateZlib(body.idat),
    body.info.width,
    body.info.height,
    body.info.colorType,
    body.info.bitDepth,
  );
  return samplesAreSeeThrough(samples, body);
}

export function objectKey(): string {
  return `items/${crypto.randomUUID()}.png`;
}
