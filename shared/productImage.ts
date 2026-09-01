const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('That is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (PRIVATE_HOSTS.has(host) || host.endsWith('.localhost') || isPrivateIPv4(host)) {
    throw new Error('That URL is not allowed.');
  }
  return url;
}

export function cleanAmazonImageUrl(raw: string): string {
  return raw.replace(/\._[^.]+(?=\.(?:jpe?g|png|webp))/i, '');
}

function firstGroup(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    const value = match?.[1]?.trim();
    if (value) return decodeHtmlEntities(value);
  }
  return null;
}

export function cleanProductTitle(raw: string | null): string | null {
  if (!raw) return null;
  let title = decodeHtmlEntities(raw).trim();
  title = title.replace(/\s*[|:]\s*Amazon\.[a-z.]+.*$/i, '');
  title = title.replace(/^Amazon\.[a-z.]+\s*[:|\-]\s*/i, '');
  title = title.replace(/\s+Amazon\.de\s*$/i, '');
  title = title.replace(/\s+/g, ' ').trim();
  return title.slice(0, 140) || null;
}

function extractDynamicImage(html: string): string | null {
  const match = /data-a-dynamic-image="([^"]+)"/.exec(html);
  if (!match?.[1]) return null;
  try {
    const map = JSON.parse(decodeHtmlEntities(match[1])) as Record<string, [number, number]>;
    let best: string | null = null;
    let area = 0;
    for (const [src, size] of Object.entries(map)) {
      if (!src.startsWith('http')) continue;
      const next = (size?.[0] ?? 0) * (size?.[1] ?? 0);
      if (next >= area) {
        area = next;
        best = src;
      }
    }
    return best;
  } catch {
    return null;
  }
}

export function extractAsin(url: URL): string | null {
  const fromPath = /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(
    url.pathname,
  );
  if (fromPath?.[1]) return fromPath[1].toUpperCase();
  const fromQuery = url.searchParams.get('asin') ?? url.searchParams.get('ASIN');
  if (fromQuery && /^[A-Z0-9]{10}$/i.test(fromQuery)) return fromQuery.toUpperCase();
  return null;
}

export function amazonCatalogImageUrl(asin: string): string {
  return `https://m.media-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`;
}

export function amazonWidgetImageUrl(page: URL, asin: string): string {
  const host = page.hostname.toLowerCase();
  const marketplace = host.includes('amazon.de')
    ? 'DE'
    : host.includes('amazon.co.uk')
      ? 'GB'
      : host.includes('amazon.fr')
        ? 'FR'
        : host.includes('amazon.it')
          ? 'IT'
          : host.includes('amazon.es')
            ? 'ES'
            : host.includes('amazon.ca')
              ? 'CA'
              : 'US';
  const adsHost =
    marketplace === 'US' || marketplace === 'CA' ? 'ws-na.amazon-adsystem.com' : 'ws-eu.amazon-adsystem.com';
  return `https://${adsHost}/widgets/q?_encoding=UTF8&MarketPlace=${marketplace}&ASIN=${asin}&ServiceVersion=20070822&ID=AsinImage&WS=1&Format=_SL1500_`;
}

export function extractProductMeta(html: string): { image: string | null; title: string | null } {
  const image =
    firstGroup(html, [
      /"hiRes"\s*:\s*"(https:\\\/\\\/[^"]+)"/,
      /"hiRes"\s*:\s*"(https:\/\/[^"]+)"/,
      /'hiRes'\s*:\s*'(https:[^']+)'/,
      /"large"\s*:\s*"(https:\/\/[^"]+)"/,
      /data-old-hires="(https:\/\/[^"]+)"/,
      /data-old-hires='(https:\/\/[^']+)'/,
      /id="landingImage"[^>]*data-old-hires="(https:\/\/[^"]+)"/,
      /property=["']og:image:secure_url["'][^>]*content=["']([^"']+)/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image:secure_url["']/i,
      /property=["']og:image["'][^>]*content=["']([^"']+)/i,
      /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      /name=["']twitter:image["'][^>]*content=["']([^"']+)/i,
      /content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
    ]) ?? extractDynamicImage(html);

  const title = firstGroup(html, [
    /property=["']og:title["'][^>]*content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
    /<title[^>]*>([^<]+)/i,
  ]);

  return {
    image: image ? cleanAmazonImageUrl(image.replace(/\\\//g, '/')) : null,
    title: cleanProductTitle(title),
  };
}

export function resolveFetchedUrl(raw: string, base: string): string {
  const absolute = new URL(raw, base).toString();
  return cleanAmazonImageUrl(absolute);
}

export const PRODUCT_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
};
