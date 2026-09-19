import { MAX_UPLOAD_BYTES } from './constants.ts';
import {
  PRODUCT_FETCH_HEADERS,
  amazonCatalogImageUrl,
  amazonWidgetImageUrl,
  assertPublicHttpUrl,
  extractAsin,
  extractProductMeta,
  resolveFetchedUrl,
} from './productImage.ts';

const MAX_HTML_BYTES = 2 * 1024 * 1024;

export type ProductHero = {
  bytes: Uint8Array;
  contentType: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
};

function looksLikeImage(contentType: string): boolean {
  return contentType.toLowerCase().startsWith('image/');
}

function mimeFromHeader(contentType: string, fallback = 'image/jpeg'): string {
  const type = contentType.split(';')[0]?.trim();
  return type && looksLikeImage(type) ? type : fallback;
}

async function readLimited(response: Response, max: number): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > max) {
    throw new Error('That file is too large.');
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > max) {
    throw new Error('That file is too large.');
  }
  return buffer;
}

async function fetchImageBytes(imageUrl: string, referer?: string): Promise<ProductHero> {
  const safe = assertPublicHttpUrl(imageUrl);
  const image = await fetch(safe.toString(), {
    headers: {
      ...PRODUCT_FETCH_HEADERS,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: 'follow',
  });
  if (image.url) assertPublicHttpUrl(image.url);
  if (!image.ok) {
    throw new Error(`Could not download the product image (${image.status}).`);
  }
  const contentType = image.headers.get('content-type') ?? '';
  if (!looksLikeImage(contentType) && !/\.(jpe?g|png|webp|gif)(?:\?|$)/i.test(safe.pathname)) {
    throw new Error('The product image URL was not an image.');
  }
  const buffer = await readLimited(image, MAX_UPLOAD_BYTES);
  if (buffer.byteLength < 32) {
    throw new Error('The product image was empty.');
  }
  return {
    bytes: new Uint8Array(buffer),
    contentType: mimeFromHeader(contentType),
    title: null,
    price: null,
    currency: null,
    imageUrl: imageUrl,
  };
}

export async function fetchProductHero(pageUrl: string): Promise<ProductHero> {
  const url = assertPublicHttpUrl(pageUrl);
  const asin = extractAsin(url);

  try {
    const page = await fetch(url.toString(), {
      headers: PRODUCT_FETCH_HEADERS,
      redirect: 'follow',
    });
    if (page.url) assertPublicHttpUrl(page.url);
    if (page.ok) {
      const contentType = page.headers.get('content-type') ?? '';
      if (looksLikeImage(contentType)) {
        const buffer = await readLimited(page, MAX_UPLOAD_BYTES);
        return {
          bytes: new Uint8Array(buffer),
          contentType: mimeFromHeader(contentType),
          title: null,
          price: null,
          currency: null,
          imageUrl: url.toString(),
        };
      }

      const html = new TextDecoder().decode(await readLimited(page, MAX_HTML_BYTES));
      const blocked =
        /opfcaptcha|validateCaptcha|automated access to Amazon data|click the button below to continue shopping|sorry, we just need to make sure you're not a robot|enter the characters you see/i.test(
          html,
        );
      if (!blocked) {
        const meta = extractProductMeta(html);
        if (meta.image) {
          const hero = await fetchImageBytes(resolveFetchedUrl(meta.image, url.toString()), `${url.origin}/`);
          return {
            ...hero,
            title: meta.title,
            price: meta.price,
            currency: meta.currency,
            imageUrl: hero.imageUrl ?? meta.image,
          };
        }
      }
    }
  } catch {
    // Fall through to Amazon image URLs when the product page is blocked.
  }

  if (asin && /amazon\./i.test(url.hostname)) {
    const fallbacks = [amazonWidgetImageUrl(url, asin), amazonCatalogImageUrl(asin)];
    let lastError: Error | null = null;
    for (const imageUrl of fallbacks) {
      try {
        return await fetchImageBytes(imageUrl, `${url.origin}/`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Could not download the product image.');
      }
    }
    if (lastError) throw lastError;
  }

  throw new Error('No product image found on that page. Drop a JPG instead.');
}
