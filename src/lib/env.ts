export function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
}

export function supabasePublishableKey(): string {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function r2PublicBaseUrl(): string {
  return (import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}

/** Amazon Associates tracking id. Override with VITE_AMAZON_ASSOCIATE_TAG. */
export function amazonAssociateTag(): string {
  const fromEnv = (import.meta.env.VITE_AMAZON_ASSOCIATE_TAG ?? '').trim();
  return fromEnv || 'typologynetwo-20';
}
