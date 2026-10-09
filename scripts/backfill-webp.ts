/**
 * Backfill WebP versions for existing PNG items in R2
 * 
 * Usage:
 *   npx tsx scripts/backfill-webp.ts [--dry-run]
 * 
 * This script:
 * 1. Lists all .png objects in the R2 bucket via S3 API
 * 2. For each PNG without a .webp counterpart, downloads it
 * 3. Converts PNG to WebP using sharp (preserving transparency)
 * 4. Uploads the WebP with proper cache headers
 * 
 * Requires environment variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME (defaults to 'knoll-items')
 *   VITE_R2_PUBLIC_BASE_URL (for downloading images)
 * 
 * Install sharp:
 *   npm install --save-dev sharp
 */

import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

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
      
      // Convert to WebP using sharp (preserves alpha channel)
      const webpBuffer = await sharp(pngBuffer)
        .webp({ quality: 90, alphaQuality: 100, lossless: false })
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
      } else {
        console.log(`   [DRY RUN] Would upload ${webpKey}`);
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
