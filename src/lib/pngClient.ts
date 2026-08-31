import {
  assertPngCanBeTransparent,
  bufferHasSeeThroughPixel,
  parsePng,
} from '../../shared/png.ts';

export type InspectedPng = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

export async function inspectPngFile(file: File): Promise<InspectedPng> {
  if (file.type && file.type !== 'image/png') {
    throw new Error('Only PNG files are accepted.');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const info = parsePng(bytes);
  assertPngCanBeTransparent(info);

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Could not read PNG pixels in this browser.');
  }
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  if (!bufferHasSeeThroughPixel(data)) {
    throw new Error(
      'This PNG has an alpha channel but no transparent pixels. Cut the background out (or export with transparency) so clicks can pass between objects.',
    );
  }

  return { bytes, width: info.width, height: info.height };
}

