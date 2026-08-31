import { r2PublicBaseUrl } from './env.ts';
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

export function openAffiliate(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'nofollow sponsored noopener';
  a.click();
}
