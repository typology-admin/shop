import { bearerToken, requireSignedIn } from '../../shared/admin';

type Env = {
  IMAGES: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestDelete(context: { request: Request; env: Env }): Promise<Response> {
  try {
    if (!context.env.SUPABASE_URL || !context.env.SUPABASE_ANON_KEY) {
      throw Object.assign(new Error('Server auth is not configured.'), { status: 500 });
    }
    const token = bearerToken(context.request.headers.get('Authorization'));
    if (!token) throw Object.assign(new Error('Sign in required.'), { status: 401 });
    const user = await requireSignedIn(context.env.SUPABASE_URL, context.env.SUPABASE_ANON_KEY, token);

    const listed = await context.env.IMAGES.list({ prefix: `users/${user.id}/` });
    await Promise.all((listed.objects ?? []).map((object) => context.env.IMAGES.delete(object.key)));

    const delProfile = await fetch(
      `${context.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${user.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: context.env.SUPABASE_ANON_KEY,
          Prefer: 'return=minimal',
        },
      },
    );
    if (!delProfile.ok && delProfile.status !== 404) {
      throw new Error('Could not delete profile data.');
    }

    if (context.env.SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${context.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      });
    }

    return json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    return json({ error: err instanceof Error ? err.message : 'Could not delete the account.' }, status);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204 });
}
