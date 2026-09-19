import { fetchProductHero } from './productImage.ts';

export type ProductDraft = {
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  blob: Blob | null;
  blocked: boolean;
};

export async function fetchProductDraft(
  url: string,
  accessToken: string | null,
): Promise<ProductDraft> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch('/api/product-image', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, meta: true }),
  });

  const priceHeader = response.headers.get('X-Product-Price');
  const currency = response.headers.get('X-Product-Currency') || 'EUR';
  const imageUrl = response.headers.get('X-Product-Image-Url');
  const encodedTitle = response.headers.get('X-Product-Title');
  const title = encodedTitle ? decodeURIComponent(encodedTitle) : '';
  const price = priceHeader && Number.isFinite(Number(priceHeader)) ? Number(priceHeader) : null;

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      title,
      price,
      currency,
      imageUrl: imageUrl || null,
      blob: null,
      blocked: true,
      ...(payload.error ? {} : {}),
    };
  }

  const blob = await response.blob();
  const looksImage = blob.type.startsWith('image/');
  return {
    title,
    price,
    currency,
    imageUrl: imageUrl || null,
    blob: looksImage ? blob : null,
    blocked: !looksImage,
  };
}

export async function fetchProductBytes(url: string, accessToken: string | null) {
  return fetchProductHero(url, accessToken);
}
