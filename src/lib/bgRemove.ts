import { prepareItemImage, type PreparedImage } from './cutout.ts';

/** Fast flood-fill cutout (same path as admin). Product photos usually sit on a light studio ground. */
export async function removeBackground(source: Blob, name = 'item.png'): Promise<PreparedImage> {
  return prepareItemImage(source, name);
}

export type { PreparedImage };
