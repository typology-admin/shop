/**
 * Remove board items whose image_path still points at local Vite `dev-uploads/`
 * paths. Those files never landed in R2, so production fetches SPA HTML instead
 * of images and can stall onLoad for seconds.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/cleanup-dev-uploads.ts
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/cleanup-dev-uploads.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
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
