import { amazonAssociateTagForHost, r2PublicBaseUrl } from './env.ts';
import { localGetBlob } from './localStore.ts';

const blobUrlCache = new Map<string, string>();

export function publicImageUrl(imagePath: string): string {
  if (
    imagePath.startsWith('data:') ||
    imagePath.startsWith('blob:') ||
    imagePath.startsWith('/') ||
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://')
  ) {
    return imagePath;
  }

  if (imagePath.startsWith('dev-uploads/')) {
    return `/${imagePath}`;
  }

  const base = r2PublicBaseUrl();
  if (base) return `${base}/${imagePath}`;
  return `/api/images/${imagePath}`;
}

export function forgetImageUrl(imagePath: string): void {
  const cached = blobUrlCache.get(imagePath);
  if (cached) URL.revokeObjectURL(cached);
  blobUrlCache.delete(imagePath);
}

export async function resolveImageUrl(imagePath: string): Promise<string | null> {
  if (imagePath.startsWith('local:')) {
    const cached = blobUrlCache.get(imagePath);
    if (cached) return cached;
    const blob = await localGetBlob(imagePath);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(imagePath, url);
    return url;
  }
  return publicImageUrl(imagePath);
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load that photo.'));
    image.src = url;
  });
}

export async function fetchImageBlob(imagePath: string): Promise<Blob> {
  const url = await resolveImageUrl(imagePath);
  if (!url) throw new Error('That photo is missing.');
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      const type = (blob.type || response.headers.get('content-type') || '').toLowerCase();
      if (!type.includes('html') && !type.startsWith('text/')) {
        if (type.startsWith('image/') || type === 'application/octet-stream') return blob;
        // Some CDNs omit content-type — accept only if the bytes look like an image.
        if (!type) {
          const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
          const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
          const isJpeg = head[0] === 0xff && head[1] === 0xd8;
          const isWebp = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
          if (isPng || isJpeg || isWebp) return blob;
        }
      }
    }
  } catch {
    // Fall through to drawing the image when CORS blocks fetch.
  }
  const image = await loadHtmlImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, image.naturalWidth);
  canvas.height = Math.max(1, image.naturalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read that photo.');
  ctx.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('Could not read that photo.');
  return blob;
}

export function inferStore(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('amazon.')) return 'Amazon';
    if (host.includes('amzn.')) return 'Amazon';
    if (host.includes('etsy.')) return 'Etsy';
    if (host.includes('ebay.')) return 'eBay';
    if (host.includes('shopify')) return 'Shopify';
    const label = host.split('.')[0] ?? '';
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
  } catch {
    return '';
  }
}

function isAmazonProductHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'amzn.to' || host === 'a.co' || host === 'amzn.eu') return false;
  return host === 'amazon.com' || host.startsWith('amazon.') || host.includes('.amazon.');
}

/** Append or replace `tag=` on full Amazon product URLs. Short links are left alone. */
export function withAmazonTag(raw: string, tag?: string): string {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!isAmazonProductHost(url.hostname)) return raw;
    const chosen = (tag ?? amazonAssociateTagForHost(url.hostname)).trim();
    if (!chosen) return raw;
    url.searchParams.set('tag', chosen);
    return url.toString();
  } catch {
    return raw;
  }
}

export function openAffiliate(url: string): void {
  const a = document.createElement('a');
  a.href = withAmazonTag(url);
  a.target = '_blank';
  a.rel = 'nofollow sponsored noopener';
  a.click();
}
