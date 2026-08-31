export function hasSupabaseConfig(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
}

export function r2PublicBaseUrl(): string {
  return (import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}
