type Env = {
  IMAGES: R2Bucket;
};

function corsHeaders(contentType?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

function keyFromParams(param: string | string[] | undefined): string | null {
  if (!param) return null;
  const value = Array.isArray(param) ? param.join('/') : param;
  const trimmed = value.replace(/^\/+/, '');
  if (!trimmed || trimmed.includes('..')) return null;
  return trimmed;
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { key?: string | string[] };
}): Promise<Response> {
  const key = keyFromParams(context.params.key);
  if (!key) return new Response('Not found', { status: 404 });

  const object = await context.env.IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  return new Response(object.body, {
    headers: corsHeaders(object.httpMetadata?.contentType ?? 'image/png'),
  });
}

export async function onRequestHead(context: {
  env: Env;
  params: { key?: string | string[] };
}): Promise<Response> {
  const key = keyFromParams(context.params.key);
  if (!key) return new Response(null, { status: 404 });
  const object = await context.env.IMAGES.get(key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(null, {
    headers: corsHeaders(object.httpMetadata?.contentType ?? 'image/png'),
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
