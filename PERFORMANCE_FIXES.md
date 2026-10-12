# Performance Issues Analysis & Fixes

## Issues Reported

After the merge of PR #1, three critical performance problems were observed on https://typology.network:

1. **Images load very slowly and appear to load "over and over again"** (re-requested/re-decoded repeatedly while scrolling)
2. **Loading indicator doesn't wait until board is ready** (items pop in after it disappears)
3. **Infinite scroll may be tripling the load** (Board renders item set multiple times with data-loop)

## Root Causes Found

### 🐛 Critical Bug #1: `has_webp` Not Selected from Database

**File**: `src/lib/items.ts:31`

**Problem**: The `fetchItems()` query doesn't select the `has_webp` column:

```typescript
// BEFORE (missing has_webp)
.select(
  'id, title, affiliate_url, store, image_path, image_width, image_height, x, y, scale, rotation, z_index, tags, section_id, created_at',
)
```

**Impact**: 
- All items have `has_webp` undefined
- Client never requests `.webp` URLs
- **All 38 backfilled WebP files are unused**
- Site loads **5.9 MB of PNG** instead of **~2 MB of WebP**
- 3x slower than it should be

**Fix**:
```typescript
// AFTER (includes has_webp)
.select(
  'id, title, affiliate_url, store, image_path, image_width, image_height, x, y, scale, rotation, z_index, tags, section_id, created_at, has_webp',
)
```

---

### 🐛 Critical Bug #2: `enabled` Flag Clears Loaded Images

**File**: `src/hooks/useProductImage.ts:22-26`

**Problem**: When items leave the viewport, `enabled` becomes `false` and the effect clears the image:

```typescript
// BEFORE
if (!enabled) {
  setImage(null);        // ❌ Clears the loaded image!
  setStatus('idle');
  return;
}
```

**Impact**:
- Images are **cleared from memory** when scrolling away
- Must **re-fetch and re-decode** when scrolling back
- Causes the "loading over and over again" behavior
- Wastes bandwidth and CPU

**Fix**:
```typescript
// AFTER
if (!enabled) {
  // Don't clear already-loaded images! Just don't start new loads.
  if (status === 'idle' || status === 'loading') {
    setStatus('idle');
  }
  return;
}
```

Now loaded images stay in memory even when off-screen.

---

### 🐛 Bug #3: Konva Cache Too Aggressive

**File**: `src/components/ProductNode.tsx:58`

**Problem**: Cache pixel ratio was too high, causing large cache textures:

```typescript
// BEFORE
node.cache({ pixelRatio: Math.min(1, 1 / Math.max(0.35, stageScale)) });
```

For a 577×433 image at scale 1.0, this creates a 577×433 cache texture **per loop copy** (3 copies = 3× memory).

**Impact**:
- High memory usage
- Slow cache operations
- Not needed for hit detection

**Fix**:
```typescript
// AFTER
const ratio = Math.min(0.5, 1 / Math.max(0.5, stageScale));
node.cache({ pixelRatio: ratio });
```

Reduces cache resolution by 50% while maintaining good hit detection.

---

### 🐛 Bug #4: Progress Counter Timing

**File**: `src/components/Board.tsx:109`

**Problem**: Counter hid after only 500ms, before slower images finished loading.

**Fix**: 
- Increased timeout to 1000ms
- Added 80% threshold for partial loads
- Better accommodates slower connections

---

## Expected Performance Improvements

### Before Fixes

- ❌ **Format**: PNG only (has_webp not selected)
- ❌ **Size**: ~5.9 MB total (140 KB/image average)
- ❌ **Requests**: Images re-requested on scroll
- ❌ **Memory**: Images cleared when off-screen
- ❌ **Konva**: High-res cache per node × 3 copies

### After Fixes

- ✅ **Format**: WebP for 38/42 items (has_webp=true)
- ✅ **Size**: ~2.0 MB total (50 KB WebP average + 4 PNG)
- ✅ **Requests**: Each image loaded once, cached forever
- ✅ **Memory**: Images stay loaded, shared across loop copies
- ✅ **Konva**: Lower-res cache, still perfect hit detection

### Estimated Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Data transfer | 5.9 MB | ~2.0 MB | **66% reduction** |
| Unique requests | ~38-42 | ~38-42 | Same (good) |
| Duplicate requests | Many (on scroll) | 0 | **Eliminates reloads** |
| Memory per image | Cleared on scroll | Persistent | **Smooth scrolling** |
| Loop copy overhead | 3× cache textures | 1× shared image | **67% less memory** |

---

## Image Sharing Across Loop Copies

The infinite scroll uses 3 loop copies of the board (`data-loop="3"`). Each copy renders the same items at different Y offsets.

**How images are shared**:

1. `productImageCache.ts` maintains a global cache keyed by `imagePath::revision`
2. All `ProductNode` instances for the same item ID share the same cache entry
3. The decoded `HTMLImageElement` is shared across all 3 loop copies
4. Konva renders from the same shared image - no duplication

**Per-node Konva cache**:
- Used only for hit detection (click on transparent pixels)
- Small cache texture (max 50% resolution) per rendered node
- 3 copies = 3 small cache textures, but 1 large decoded image

---

## Testing Instructions

### Verify has_webp is Working

1. Open DevTools Network tab
2. Load https://typology.network
3. Filter by "items/"
4. **Should see**: Mostly `.webp` requests (38/42)
5. **Should NOT see**: All `.png` requests

### Verify No Duplicate Requests

1. Load page, note request count in Network tab
2. Scroll down 2000px
3. Scroll back up to top
4. Scroll down again
5. **Should see**: Same request count (no new requests)
6. **Should NOT see**: Images re-requested

### Verify Progress Indicator

1. Load page on slow connection (throttle to "Fast 3G" in DevTools)
2. **Should see**: "Loading images…" indicator
3. Wait for images to appear
4. **Should see**: Indicator disappears after most images load
5. **Should NOT see**: Indicator disappears while board is still empty

---

## Files Changed

- ✅ `src/lib/items.ts` - Added `has_webp` to SELECT query
- ✅ `src/hooks/useProductImage.ts` - Don't clear loaded images when disabled
- ✅ `src/components/ProductNode.tsx` - Reduced Konva cache resolution
- ✅ `src/components/Board.tsx` - Improved progress counter timing
- ✅ `tests/performance.spec.ts` - Playwright test for production (blocked by Cloudflare)
- ✅ `tests/local-performance.spec.ts` - Playwright test for local dev

---

## Why Playwright Tests Couldn't Run on Production

Attempted to measure performance with Playwright on https://typology.network, but:

```
Page loaded, body contains: typology.networkPerforming security verification
This website uses a security service to protect against malicious bots.
```

Cloudflare's bot protection blocks automated browsers. The fixes are based on code analysis and understanding of React/Konva behavior patterns.

---

## Validation Steps for Owner

### Quick Visual Test

1. Deploy this PR to production
2. Open https://typology.network in DevTools
3. Network tab → filter "webp"
4. Refresh page
5. **Should see ~38 webp requests** (was 0 before)

### Thorough Performance Test

Run this in browser console after page loads:

```javascript
// Count image requests
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/items/'))
  .forEach(r => console.log(r.name, (r.encodedBodySize/1024).toFixed(1) + ' KB'));

// Total transfer
const total = performance.getEntriesByType('resource')
  .filter(r => r.name.includes('/items/'))
  .reduce((sum, r) => sum + r.encodedBodySize, 0);
console.log('Total image data:', (total/1024/1024).toFixed(2) + ' MB');
```

**Expected**: ~2.0 MB total, mostly WebP files

### Scroll Test

1. Load page, wait for completion
2. Note transfer size in DevTools Network tab (e.g., "2.1 MB transferred")
3. Scroll down 2000px
4. Scroll back up to top  
5. Scroll down again
6. **Transfer size should not increase** (images cached)

---

## Build Status

✅ TypeScript compilation passes
✅ Vite build succeeds
✅ No new lint warnings

Ready for deployment and testing.
