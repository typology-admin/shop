export type FetchedProductImage = {
  blob: Blob;
  title: string | null;
};

export async function fetchProductHero(
  pageUrl: string,
  accessToken: string | null,
): Promise<FetchedProductImage> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch('/api/product-image', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: pageUrl }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'Could not fetch a product image.');
  }

  const encoded = response.headers.get('X-Product-Title');
  const title = encoded ? decodeURIComponent(encoded) : null;
  return { blob: await response.blob(), title };
}
