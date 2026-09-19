import { isCrawler, ogHtml, spaFallback } from '../_og';

type Env = {
  ASSETS: { fetch: (input: Request) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_R2_PUBLIC_BASE_URL?: string;
};

export async function onRequest(context: { request: Request; env: Env; params: { path?: string } }) {
  if (!isCrawler(context.request.headers.get('user-agent') ?? '')) {
    return spaFallback(context.request, context.env);
  }

  const parts = (context.params.path ?? '').split('/').filter(Boolean);
  const username = parts[0] ?? '';
  const slug = parts[1];
  const origin = new URL(context.request.url).origin;
  const supabaseUrl = context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL || '';
  const key =
    context.env.SUPABASE_ANON_KEY || context.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  if (!slug || !supabaseUrl || !key) {
    return spaFallback(context.request, context.env);
  }

  const handle = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/profile_handles?username=eq.${encodeURIComponent(username)}&select=id,username,display_name`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  ).then((r) => r.json() as Promise<Array<{ id: string; username: string; display_name: string }>>);

  const profile = handle[0];
  if (!profile) return spaFallback(context.request, context.env);

  const boards = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_boards?owner_id=eq.${profile.id}&slug=eq.${encodeURIComponent(slug)}&visibility=eq.public&select=id,title,og_image_path`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  ).then((r) => r.json() as Promise<Array<{ id: string; title: string; og_image_path: string | null }>>);

  const board = boards[0];
  if (!board) return spaFallback(context.request, context.env);

  const items = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_board_items?board_id=eq.${board.id}&select=image_path,source_image_url&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
    .then((r) => r.json() as Promise<Array<{ image_path: string | null; source_image_url: string | null }>>)
    .catch(() => []);

  const raw = board.og_image_path || items[0]?.image_path || items[0]?.source_image_url;
  const image = raw
    ? raw.startsWith('http')
      ? raw
      : `${(context.env.VITE_R2_PUBLIC_BASE_URL || origin).replace(/\/$/, '')}/${raw}`
    : null;

  return new Response(
    ogHtml({
      title: `${board.title} — @${profile.username}`,
      description: `A knolling board by @${profile.username} on typology network.`,
      url: `${origin}/u/${profile.username}/${slug}`,
      image,
    }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
