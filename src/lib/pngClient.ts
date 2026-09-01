import {
  assertPngCanBeTransparent,
  parsePng,
  pngHasSeeThroughPixel,
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

  if (!(await pngHasSeeThroughPixel(bytes))) {
    throw new Error(
      'This PNG has an alpha channel but no transparent pixels. Cut the background out (or export with transparency) so clicks can pass between objects.',
    );
  }

  return { bytes, width: info.width, height: info.height };
}
