const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export function assertItemImageFile(file: File): void {
  const type = file.type.toLowerCase();
  const named = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  if ((type && IMAGE_TYPES.has(type)) || named) return;
  throw new Error('Use a JPG, PNG, or WebP photo.');
}
