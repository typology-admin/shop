import { ADMIN_ROLE } from './constants.ts';

export function payloadIsAdmin(user: {
  app_metadata?: { role?: unknown; roles?: unknown };
}): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.role === ADMIN_ROLE) return true;
  return Array.isArray(meta.roles) && meta.roles.includes(ADMIN_ROLE);
}

export async function fetchAuthedUser(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string,
): Promise<{ app_metadata?: { role?: unknown; roles?: unknown } }> {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
  });
  if (!response.ok) {
    throw new Error('Not authenticated.');
  }
  return (await response.json()) as {
    app_metadata?: { role?: unknown; roles?: unknown };
  };
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
