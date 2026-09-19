import { isCrawler, ogHtml, spaFallback } from '../_og';

type Env = {
  ASSETS: { fetch: (input: Request) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_R2_PUBLIC_BASE_URL?: string;
};

export async function onRequest(context: { request: Request; env: Env; params: { token: string } }) {
  if (!isCrawler(context.request.headers.get('user-agent') ?? '')) {
    return spaFallback(context.request, context.env);
  }

  const token = context.params.token;
  const origin = new URL(context.request.url).origin;
  const supabaseUrl = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL || '';
  const key =
    context.env.SUPABASE_ANON_KEY || context.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!supabaseUrl || !key) return spaFallback(context.request, context.env);

  const opened = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/open_shared_board`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
  });
  if (!opened.ok) return spaFallback(context.request, context.env);
  const payload = (await opened.json()) as {
    board?: { title?: string; og_image_path?: string | null };
    items?: Array<{ image_path?: string | null; source_image_url?: string | null }>;
  };
  const raw =
    payload.board?.og_image_path ||
    payload.items?.[0]?.image_path ||
    payload.items?.[0]?.source_image_url;
  const image = raw
    ? raw.startsWith('http')
      ? raw
      : `${(context.env.VITE_R2_PUBLIC_BASE_URL || origin).replace(/\/$/, '')}/${raw}`
    : null;

  return new Response(
    ogHtml({
      title: payload.board?.title || 'Shared board',
      description: 'A shared knolling board on typology network.',
      url: `${origin}/s/${token}`,
      image,
    }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
