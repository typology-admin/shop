const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export type PngInfo = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  hasAlphaChannel: boolean;
  hasTransparencyChunk: boolean;
};

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

export function parsePng(bytes: Uint8Array): PngInfo {
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

  if (width < 1 || height < 1) {
    throw new Error('Invalid PNG dimensions.');
  }

  let hasTransparencyChunk = false;
  let offset = 8 + 12 + ihdrLength;
  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset);
    const type = chunkType(bytes, offset + 4);
    if (type === 'tRNS') hasTransparencyChunk = true;
    if (type === 'IEND') break;
    offset += 12 + length;
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    hasAlphaChannel: colorType === 4 || colorType === 6,
    hasTransparencyChunk,
  };
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

export function objectKey(): string {
  return `items/${crypto.randomUUID()}.png`;
}
