import { getSupabase } from './supabase.ts';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const RESERVED_USERNAMES = new Set([
  'admin',
  'me',
  'login',
  'network',
  'api',
  'u',
  's',
  'auth',
  'shop',
  'about',
  'privacy',
  'terms',
  'affiliates',
  'contact',
]);

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name?: string | null;
  display_name?: string | null;
};

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameError(raw: string): string | null {
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use 3–24 characters: lowercase letters, numbers, or underscore.';
  }
  if (RESERVED_USERNAMES.has(username)) {
    return 'That username is reserved.';
  }
  return null;
}

function asProfile(row: ProfileRow): Profile {
  const username = row.username ?? null;
  const display =
    (row.display_name ?? row.full_name ?? '').trim() || username || '';
  return { id: row.id, username, display_name: display };
}

export function authRedirectUrl(): string {
  return `${window.location.origin}/login`;
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return asProfile(data as ProfileRow);

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select('id, username, full_name')
    .maybeSingle();
  if (insertError) {
    const { data: retry, error: retryError } = await supabase
      .from('profiles')
      .select('id, username, full_name')
      .eq('id', userId)
      .maybeSingle();
    if (retryError) throw retryError;
    return retry ? asProfile(retry as ProfileRow) : null;
  }
  return created ? asProfile(created as ProfileRow) : null;
}

export async function fetchPublicProfile(username: string): Promise<Profile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) return null;
  const { data, error } = await supabase
    .from('profile_handles')
    .select('id, username, display_name')
    .eq('username', normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? asProfile(data as ProfileRow) : null;
}

export async function claimUsername(userId: string, raw: string): Promise<Profile> {
  const username = normalizeUsername(raw);
  const invalid = usernameError(username);
  if (invalid) throw new Error(invalid);

  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId)
    .select('id, username, full_name')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      throw new Error('That username is already taken.');
    }
    if (error.code === '23514') {
      throw new Error(usernameError(username) ?? 'That username is not allowed.');
    }
    throw error;
  }
  if (!data) {
    throw new Error('Could not save the username. Try signing out and back in.');
  }
  return asProfile(data as ProfileRow);
}

export async function updateDisplayName(userId: string, raw: string): Promise<Profile> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const full_name = raw.trim().slice(0, 80);
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: full_name || null })
    .eq('id', userId)
    .select('id, username, full_name')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Could not save the display name.');
  return asProfile(data as ProfileRow);
}
