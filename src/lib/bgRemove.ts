import { prepareItemImage, type PreparedImage } from './cutout.ts';

export async function removeBackground(source: Blob, name = 'item.png'): Promise<PreparedImage> {
  try {
    const { removeBackground: imglyRemove } = await import('@imgly/background-removal');
    const blob = await imglyRemove(source, { output: { format: 'image/png' } });
    return prepareItemImage(blob, name);
  } catch {
    return prepareItemImage(source, name);
  }
}
