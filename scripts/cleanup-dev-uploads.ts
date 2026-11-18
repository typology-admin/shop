/**
 * Remove board items whose image_path still points at local Vite `dev-uploads/`
 * paths. Those files never landed in R2, so production fetches SPA HTML instead
 * of images and can stall onLoad for seconds.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/cleanup-dev-uploads.ts
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/cleanup-dev-uploads.ts --dry-run
 *
 * SUPABASE_SERVICE_ROLE_KEY may be either the legacy service_role JWT or a
 * Supabase management PAT (`sbp_…`); PATs are resolved to the project JWT.
 */

import { createClient } from '@supabase/supabase-js';

const isDryRun = process.argv.includes('--dry-run');

function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function resolveServiceRoleKey(
  supabaseUrl: string,
  key: string,
): Promise<string> {
  if (!key.startsWith('sbp_')) return key;

  const ref = projectRefFromUrl(supabaseUrl);
  if (!ref) {
    throw new Error('Could not derive project ref from SUPABASE_URL for PAT lookup');
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    throw new Error(`Management API key lookup failed (${response.status})`);
  }
  const keys = (await response.json()) as Array<{ name?: string; id?: string; api_key?: string }>;
  const service = keys.find((k) => k.name === 'service_role' || k.id === 'service_role');
  if (!service?.api_key) {
    throw new Error('No service_role key returned for this project');
  }
  console.log('Resolved management PAT to project service_role JWT');
  return service.api_key;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !rawKey) {
    console.error('Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  let supabaseKey: string;
  try {
    supabaseKey = await resolveServiceRoleKey(supabaseUrl, rawKey);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('items')
    .select('id, title, image_path')
    .like('image_path', 'dev-uploads/%');

  if (error) {
    console.error('Failed to list broken items:', error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('No dev-uploads items found.');
    return;
  }

  console.log(`Found ${rows.length} broken item(s):`);
  for (const row of rows) {
    console.log(`  ${row.id}  ${row.image_path}  ${JSON.stringify(row.title)}`);
  }

  if (isDryRun) {
    console.log('Dry run — not deleting.');
    return;
  }

  const ids = rows.map((row) => row.id);

  // Drop network overlays first when present (FK or orphan rows).
  const { error: networkError } = await supabase
    .from('network_items')
    .delete()
    .in('item_id', ids);
  if (networkError) {
    console.warn('network_items cleanup:', networkError.message);
  }

  const { error: deleteError } = await supabase.from('items').delete().in('id', ids);
  if (deleteError) {
    console.error('Failed to delete items:', deleteError.message);
    process.exit(1);
  }

  console.log(`Deleted ${ids.length} item(s).`);
}

void main();
