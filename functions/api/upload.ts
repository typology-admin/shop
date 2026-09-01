import { MAX_UPLOAD_BYTES } from '../../shared/constants';
import { bearerToken, fetchAuthedUser, userIsProjectAdmin } from '../../shared/admin';
import {
  assertPngCanBeTransparent,
  objectKey,
  parsePng,
  pngHasSeeThroughPixel,
} from '../../shared/png';

type Env = {
  IMAGES: R2Bucket;
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

    const buffer = await context.request.arrayBuffer();
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return json({ error: 'PNG is too large (max 10MB).' }, 413);
    }
    if (buffer.byteLength === 0) {
      return json({ error: 'Empty upload.' }, 400);
    }

    const bytes = new Uint8Array(buffer);
    const info = parsePng(bytes);
    assertPngCanBeTransparent(info);

    const transparent = await pngHasSeeThroughPixel(bytes);
    if (!transparent) {
      return json(
        {
          error:
            'This PNG has an alpha channel but no transparent pixels. Export it on a transparent background.',
        },
        400,
      );
    }

    const key = objectKey();
    await context.env.IMAGES.put(key, buffer, {
      httpMetadata: { contentType: 'image/png' },
    });

    return json({ path: key, width: info.width, height: info.height });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return json({ error: message }, status);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204 });
}
