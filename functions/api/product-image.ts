import {
  bearerToken,
  countRecentHits,
  recordHit,
  requireSignedIn,
} from '../../shared/admin';
import { fetchProductHero } from '../../shared/fetchProductImage';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

const FETCH_LIMIT = 40;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    if (!context.env.SUPABASE_URL || !context.env.SUPABASE_ANON_KEY) {
      throw Object.assign(new Error('Server auth is not configured.'), { status: 500 });
    }
    const token = bearerToken(context.request.headers.get('Authorization'));
    if (!token) throw Object.assign(new Error('Sign in required.'), { status: 401 });
    const user = await requireSignedIn(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY, token);

    const hits = await countRecentHits(
      context.env.SUPABASE_URL,
      context.env.SUPABASE_ANON_KEY,
      token,
      user.id,
      'product-image',
      60 * 60 * 1000,
    );
    if (hits >= FETCH_LIMIT) {
      return json({ error: 'Too many fetches this hour. Try again later.' }, 429);
    }
    await recordHit(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY, token, user.id, 'product-image');

    const payload = (await context.request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    if (!url) return json({ error: 'Paste a product URL.' }, 400);

    const hero = await fetchProductHero(url);
    return new Response(hero.bytes, {
      status: 200,
      headers: {
        'Content-Type': hero.contentType,
        'Cache-Control': 'no-store',
        ...(hero.title ? { 'X-Product-Title': encodeURIComponent(hero.title) } : {}),
        ...(hero.price != null ? { 'X-Product-Price': String(hero.price) } : {}),
        ...(hero.currency ? { 'X-Product-Currency': hero.currency } : {}),
        ...(hero.imageUrl ? { 'X-Product-Image-Url': hero.imageUrl } : {}),
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : 'Could not fetch a product image.';
    return json({ error: message, fallback: true }, status);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204 });
}
