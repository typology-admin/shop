/**
 * Backfill WebP versions for existing PNG items in R2
 * 
 * Usage:
 *   npx tsx scripts/backfill-webp.ts [--dry-run]
 * 
 * This script:
 * 1. Lists all .png objects in the R2 bucket via S3 API
 * 2. For each PNG without a .webp counterpart, downloads it
 * 3. Converts PNG to WebP with optimized settings (quality 80, alphaQuality 95, effort 6)
 * 4. Uploads the WebP with proper cache headers
 * 5. Updates the database to set has_webp=true
 * 
 * Requires environment variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME (defaults to 'knoll-items')
 *   VITE_R2_PUBLIC_BASE_URL (for downloading images)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for updating has_webp flag)
 */

import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const isDryRun = process.argv.includes('--dry-run');

interface R2Object {
  Key: string;
  Size: number;
}

// Parse S3 XML list response
function parseListObjects(xml: string): R2Object[] {
  const objects: R2Object[] = [];
  const keyRegex = /<Key>([^<]+)<\/Key>/g;
  const sizeRegex = /<Size>(\d+)<\/Size>/g;
  
  const keys = Array.from(xml.matchAll(keyRegex)).map(m => m[1]);
  const sizes = Array.from(xml.matchAll(sizeRegex)).map(m => parseInt(m[1], 10));
  
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] && sizes[i] !== undefined) {
      objects.push({ Key: keys[i]!, Size: sizes[i]! });
    }
  }
  
  return objects;
}

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'knoll-items';
  const publicBaseUrl = process.env.VITE_R2_PUBLIC_BASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('Error: Missing required R2 credentials');
    console.error('Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  
  if (!publicBaseUrl) {
    console.error('Error: VITE_R2_PUBLIC_BASE_URL is required');
    console.error('This should be your R2 public URL (e.g., https://images.typology.network)');
    process.exit(1);
  }
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    console.error('These are needed to update the has_webp flag in the database');
    process.exit(1);
  }
  
  // Initialize Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  
  console.log(`Bucket: ${bucketName}`);
  console.log(`Public URL: ${publicBaseUrl}`);
  if (isDryRun) {
    console.log('DRY RUN MODE - no changes will be made');
  }
  console.log('');
  
  // Initialize AWS S3 client for R2
  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  });
  
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}`;
  
  // List all objects
  console.log('Listing objects...');
  const listResponse = await r2.fetch(`${endpoint}?list-type=2&max-keys=1000`);
  
  if (!listResponse.ok) {
    console.error('Failed to list R2 objects:', await listResponse.text());
    process.exit(1);
  }
  
  const listXml = await listResponse.text();
  const objects = parseListObjects(listXml);
  
  const pngObjects = objects.filter(obj => obj.Key.endsWith('.png'));
  const webpKeys = new Set(objects.filter(obj => obj.Key.endsWith('.webp')).map(obj => obj.Key));
  
  console.log(`Found ${pngObjects.length} PNG objects`);
  console.log(`Found ${webpKeys.size} existing WebP objects\n`);
  
  let converted = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const obj of pngObjects) {
    const webpKey = obj.Key.replace(/\.png$/, '.webp');
    
    if (webpKeys.has(webpKey)) {
      console.log(`⏭️  Skip: ${obj.Key} (WebP exists)`);
      skipped++;
      continue;
    }
    
    try {
      console.log(`🔄 ${obj.Key}...`);
      
      // Download PNG
      const pngUrl = `${publicBaseUrl}/${obj.Key}`;
      const pngResponse = await fetch(pngUrl);
      if (!pngResponse.ok) {
        throw new Error(`HTTP ${pngResponse.status}`);
      }
      
      const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());
      
      // Convert to WebP with optimized settings for cut-outs
      // quality: 80 for main image (good for product photos)
      // alphaQuality: 95 keeps transparency edges clean
      // effort: 6 for better compression (0=fast, 6=best)
      const webpBuffer = await sharp(pngBuffer)
        .webp({ quality: 80, alphaQuality: 95, effort: 6, lossless: false })
        .toBuffer();
      
      const originalKB = (obj.Size / 1024).toFixed(1);
      const webpKB = (webpBuffer.length / 1024).toFixed(1);
      const saved = (((obj.Size - webpBuffer.length) / obj.Size) * 100).toFixed(0);
      
      console.log(`   ${originalKB} KB → ${webpKB} KB (${saved}% saved)`);
      
      if (!isDryRun) {
        // Upload WebP to R2
        const uploadResponse = await r2.fetch(`${endpoint}/${webpKey}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
          body: webpBuffer,
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }
        
        console.log(`   ✅ Uploaded ${webpKey}`);
        
        // Update database: set has_webp=true for this item
        // Extract the path from the key (e.g., "items/uuid.png" -> "items/uuid.png")
        const { error: dbError } = await supabase
          .from('items')
          .update({ has_webp: true })
          .eq('image_path', obj.Key);
        
        if (dbError) {
          console.warn(`   ⚠️  Database update failed: ${dbError.message}`);
        } else {
          console.log(`   ✅ Updated database: has_webp=true`);
        }
      } else {
        console.log(`   [DRY RUN] Would upload ${webpKey}`);
        console.log(`   [DRY RUN] Would set has_webp=true for ${obj.Key}`);
      }
      
      converted++;
    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
      failed++;
    }
    
    console.log('');
  }
  
  console.log('═'.repeat(50));
  console.log('Summary:');
  console.log(`  Converted: ${converted}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  
  if (isDryRun) {
    console.log('\n💡 Run without --dry-run to actually upload the WebP files');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
