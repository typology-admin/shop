import {
  INSTAGRAM_POST_HEIGHT,
  INSTAGRAM_POST_WIDTH,
} from '../../shared/constants.ts';
import { resolveImageUrl } from './images.ts';
import type { Item } from './types.ts';

export function itemShareUrl(id: string): string {
  const url = new URL('/', window.location.origin);
  url.searchParams.set('item', id);
  return url.toString();
}

export async function copyItemLink(id: string): Promise<void> {
  const text = itemShareUrl(id);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.left = '-9999px';
  document.body.appendChild(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

function fileStem(item: Item): string {
  const raw = item.title.trim().toLowerCase() || `typology-${item.id.slice(0, 8)}`;
  const slug = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `typology-${item.id.slice(0, 8)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src) && !src.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the image for export.'));
    img.src = src;
  });
}

export async function exportInstagramPostPng(item: Item): Promise<void> {
  const src = await resolveImageUrl(item.image_path);
  if (!src) throw new Error('This object has no image to export.');
  const img = await loadImage(src);

  const canvas = document.createElement('canvas');
  canvas.width = INSTAGRAM_POST_WIDTH;
  canvas.height = INSTAGRAM_POST_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the post.');

  ctx.fillStyle = '#c5c1b6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 100;
  const captionH = 140;
  const maxW = canvas.width - pad * 2;
  const maxH = canvas.height - pad - captionH;
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (canvas.width - w) / 2, pad + (maxH - h) / 2, w, h);

  ctx.fillStyle = '#1c1b18';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (item.title.trim()) {
    ctx.font = '500 28px "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(item.title.trim(), canvas.width / 2, canvas.height - 88, canvas.width - 160);
  }
  ctx.font = '400 22px "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.globalAlpha = 0.55;
  ctx.fillText('typology network', canvas.width / 2, canvas.height - 48);
  ctx.globalAlpha = 1;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => {
      if (next) resolve(next);
      else reject(new Error('Could not export PNG. Try a same-origin image.'));
    }, 'image/png');
  });

  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${fileStem(item)}.png`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}
