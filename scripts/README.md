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

1. **Environment variables** set in your `.env` file:
   ```bash
   R2_ACCOUNT_ID=your-account-id
   R2_ACCESS_KEY_ID=your-access-key
   R2_SECRET_ACCESS_KEY=your-secret-key
   R2_BUCKET_NAME=knoll-items
   VITE_R2_PUBLIC_BASE_URL=https://images.typology.network
   ```

2. **Dependencies installed**:
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
3. Converts to WebP using [sharp](https://sharp.pixelplumbing.com/)
4. Uploads to R2 with:
   - `Content-Type: image/webp`
   - `Cache-Control: public, max-age=31536000, immutable`

## Expected Results

For a board with ~42 items totaling ~5.9 MB:
- WebP versions: ~4.0-4.5 MB total
- Savings: ~25-30% reduction in bandwidth
- Time to complete: ~2-5 minutes (depending on file sizes)

## After Running the Script

The website will automatically:
1. Detect WebP browser support on first load
2. Request `.webp` versions for all PNG items
3. Fall back to `.png` if WebP doesn't exist or fails to load

**Important**: The old PNG URLs continue to work, so nothing breaks before or during the backfill.

## Troubleshooting

### "Failed to list R2 objects"

- Check that your R2 credentials are correct
- Verify `R2_ACCOUNT_ID` matches your Cloudflare account

### "HTTP 404" or "HTTP 403" when downloading

- Verify `VITE_R2_PUBLIC_BASE_URL` is correct
- Check that your R2 bucket has public access enabled
- Ensure CORS is configured (see Cloudflare Settings below)

### "Upload failed"

- Verify your R2 access key has write permissions
- Check that bucket name matches `R2_BUCKET_NAME`

## Performance Impact

Before backfill (PNG only):
- 42 items × ~140 KB average = ~5.9 MB
- cf-cache-status: DYNAMIC (not cached)

After backfill + Cloudflare settings:
- 42 items × ~100 KB average = ~4.2 MB (WebP)
- cf-cache-status: HIT (cached at edge)
- Estimated load time improvement: 40-60% faster

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
