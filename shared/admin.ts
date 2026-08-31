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
): Promise<{ id?: string; app_metadata?: { role?: unknown; roles?: unknown } }> {
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
    id?: string;
    app_metadata?: { role?: unknown; roles?: unknown };
  };
}

export async function userIsProjectAdmin(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string,
  user: { id?: string; app_metadata?: { role?: unknown; roles?: unknown } },
): Promise<boolean> {
  if (payloadIsAdmin(user)) return true;
  if (!user.id) return false;
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, '')}/rest/v1/admin_users?user_id=eq.${user.id}&select=user_id`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as unknown;
  return Array.isArray(rows) && rows.length > 0;
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}
