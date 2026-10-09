# WebP Backfill Script

This script generates WebP versions of existing PNG images in your R2 bucket to improve page load performance.

## Why WebP?

WebP provides significantly better compression than PNG while maintaining transparency:
- Typically 25-35% smaller file size
- Preserves full alpha channel transparency
- Supported by all modern browsers (95%+ coverage)
- Falls back to PNG automatically for older browsers

## Prerequisites

Before running the script, ensure you have:

1. **Database migration** applied:
   ```sql
   -- Run this in your Supabase SQL editor:
   -- supabase/migrations/20261009000000_add_has_webp.sql
   alter table public.items 
   add column if not exists has_webp boolean not null default false;
   
   create index if not exists items_has_webp_idx on public.items (has_webp);
   ```

2. **Environment variables** set in your `.env` file:
   ```bash
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=knoll-items
   VITE_R2_PUBLIC_BASE_URL=https://images.typology.network
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Dependencies installed**:
   ```bash
   npm install
   ```

## Usage

### Dry Run (Recommended First)

Test the script without making any changes:

```bash
npm run backfill:webp:dry-run
```

This will:
- List all PNG files in your bucket
- Show which ones already have WebP versions
- Display estimated file size savings
- **Not upload anything**

### Production Run

Once you've verified the dry run output:

```bash
npm run backfill:webp
```

This will:
- Download each PNG from your R2 bucket
- Convert it to WebP (quality: 90%, preserving transparency)
- Upload the WebP to R2 with immutable cache headers
- Skip any PNGs that already have WebP versions

## What the Script Does

For each `items/{uuid}.png` file:

1. Checks if `items/{uuid}.webp` already exists (skips if yes)
2. Downloads the PNG from your public R2 URL
3. Converts to WebP using [sharp](https://sharp.pixelplumbing.com/) with optimized settings:
   - Quality: 80 (lossy but visually lossless for product photos)
   - Alpha quality: 95 (keeps transparency edges clean)
   - Effort: 6 (maximum compression without artifacts)
4. Uploads to R2 with:
   - `Content-Type: image/webp`
   - `Cache-Control: public, max-age=31536000, immutable`
5. Updates the database: sets `has_webp=true` for each item

## Expected Results

For a board with ~42 items totaling ~5.9 MB:
- WebP versions: ~1.5-2.5 MB total (quality 80, much better compression)
- Savings: ~60-70% reduction in bandwidth
- Time to complete: ~2-5 minutes (depending on file sizes)

Example: A 577×433 PNG at 508 KB should compress to ~80-120 KB as WebP.

## After Running the Script

The website will automatically:
1. Check the `has_webp` flag in the database
2. Only request `.webp` URLs when `has_webp=true`
3. Detect WebP browser support on first load
4. Fall back to `.png` if WebP load fails

**Important**: No unnecessary 404 requests! The client only tries WebP when the database says it exists.

## Troubleshooting

### "Failed to list R2 objects" or "HTTP 404"

- Check that your R2 credentials are correct
- Verify `R2_ACCOUNT_ID` matches your Cloudflare account
- Verify `VITE_R2_PUBLIC_BASE_URL` is correct
- Check that your R2 bucket has public access enabled

### "Database update failed"

- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check that the migration has been applied (`has_webp` column exists)
- Ensure service role key has write permissions

### "Upload failed"

- Verify your R2 access key has write permissions
- Check that bucket name matches `R2_BUCKET_NAME`

## Performance Impact

Before backfill (PNG only):
- 42 items × ~140 KB average = ~5.9 MB
- cf-cache-status: DYNAMIC (not cached)
- has_webp: false (client uses PNG)

After backfill + Cloudflare settings:
- 42 items × ~40-60 KB average = ~1.8-2.5 MB (WebP with quality 80)
- Reduction: ~60-70% smaller file sizes
- cf-cache-status: HIT (cached at edge)
- has_webp: true (client uses WebP)
- Estimated load time improvement: 60-75% faster

## Cloudflare Dashboard Settings

After running the backfill, configure these settings in your Cloudflare dashboard for `typology.network`:

### 1. Cache Rules (Required)

Navigate to **Caching** → **Cache Rules** and create a rule:

**Name**: Cache images.typology.network

**When incoming requests match**:
- Hostname equals `images.typology.network`

**Then**:
- Cache eligibility: Eligible for cache
- Setting: Browser TTL → Respect origin
- Edge TTL: 1 year

### 2. Polish (Optional but Recommended)

Navigate to **Speed** → **Optimization** → **Image Optimization**:

- Enable **Polish**: Lossless or Lossy (Lossy recommended)
  - This will automatically serve WebP/AVIF to supporting browsers
  - Provides additional compression beyond what's in R2

### 3. Cache Reserve (Optional for High Traffic)

For high-traffic boards, enable **Cache Reserve**:
- Navigate to **Caching** → **Tiered Cache**
- Enable Cache Reserve
- Images persist in Cloudflare's cold cache layer

## Notes

- The script handles up to 1000 objects (pagination not implemented)
- WebP files use 90% quality with 100% alpha quality
- PNG files are never deleted or modified
- The backfill is idempotent (safe to run multiple times)
- WebP files are named `{uuid}.webp` matching `{uuid}.png`

## Future Uploads

All new uploads automatically:
1. Save the original PNG with immutable cache headers
2. Generate WebP version (once implemented in upload flow)

The upload pipeline will be updated in a future commit to generate WebP at upload time, making this backfill a one-time operation.
