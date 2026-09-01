import { bearerToken, fetchAuthedUser, userIsProjectAdmin } from '../../shared/admin';
import { fetchProductHero } from '../../shared/fetchProductImage';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function requireAdmin(request: Request, env: Env): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw Object.assign(new Error('Server auth is not configured.'), { status: 500 });
  }
  const token = bearerToken(request.headers.get('Authorization'));
  if (!token) {
    throw Object.assign(new Error('Sign in required.'), { status: 401 });
  }
  const user = await fetchAuthedUser(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token);
  const allowed = await userIsProjectAdmin(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    token,
    user,
  );
  if (!allowed) {
    throw Object.assign(new Error('Admin role required.'), { status: 403 });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    await requireAdmin(context.request, context.env);

    const payload = (await context.request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
    if (!url) {
      return json({ error: 'Paste a product URL.' }, 400);
    }

    const hero = await fetchProductHero(url);
    return new Response(hero.bytes, {
      status: 200,
      headers: {
        'Content-Type': hero.contentType,
        'Cache-Control': 'no-store',
        ...(hero.title ? { 'X-Product-Title': encodeURIComponent(hero.title) } : {}),
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : 'Could not fetch a product image.';
    return json({ error: message }, status);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204 });
}
