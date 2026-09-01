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
