/**
 * Local performance test - measures image loading on localhost
 */

import { test } from '@playwright/test';

test('measure local performance', async ({ page }) => {
  test.setTimeout(60000);
  
  const imageRequests: Map<string, number> = new Map();
  const imageBytes: Map<string, number> = new Map();
  let totalBytes = 0;
  let webpCount = 0;
  let pngCount = 0;
  
  // Track all image requests
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/items/') || url.includes('image')) {
      const count = imageRequests.get(url) || 0;
      imageRequests.set(url, count + 1);
      
      try {
        const body = await response.body();
        const size = body.length;
        if (!imageBytes.has(url)) {
          imageBytes.set(url, size);
          totalBytes += size;
        }
        
        if (url.endsWith('.webp')) webpCount++;
        if (url.endsWith('.png')) pngCount++;
        
        const filename = url.split('/').pop() || url;
        if (count === 0) {
          console.log(`📥 ${filename} - ${(size / 1024).toFixed(1)} KB`);
        } else {
          console.log(`⚠️  ${filename} - DUPLICATE REQUEST #${count + 1}`);
        }
      } catch (e) {
        // Ignore
      }
    }
  });
  
  console.log('\n🔍 Loading localhost:5173...\n');
  
  const startTime = Date.now();
  await page.goto('http://localhost:5173', { timeout: 30000 });
  
  // Wait for canvas
  await page.waitForSelector('canvas', { timeout: 15000 });
  console.log('✅ Canvas rendered');
  
  // Wait for images to load
  await page.waitForTimeout(5000);
  
  const afterInitialLoad = Date.now();
  console.log(`\n⏱️  Initial load: ${afterInitialLoad - startTime}ms\n`);
  
  // Check loading indicator
  const progressVisible = await page.locator('.image-progress').isVisible().catch(() => false);
  console.log(`Loading indicator visible: ${progressVisible ? 'YES (should be hidden!)' : 'NO (good)'}`);
  
  // Scroll down
  console.log('\n📜 Scrolling down...');
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(2000);
  
  const requestsAfterScroll1 = imageRequests.size;
  
  // Scroll back up
  console.log('📜 Scrolling back up...');
  await page.evaluate(() => window.scrollBy(0, -2000));
  await page.waitForTimeout(2000);
  
  const requestsAfterScroll2 = imageRequests.size;
  
  // Scroll down again (should not reload)
  console.log('📜 Scrolling down again...\n');
  await page.evaluate(() => window.scrollBy(0, 2000));
  await page.waitForTimeout(2000);
  
  const requestsAfterScroll3 = imageRequests.size;
  
  // Report
  console.log('='.repeat(60));
  console.log('📊 PERFORMANCE RESULTS');
  console.log('='.repeat(60) + '\n');
  
  console.log('Image Requests:');
  console.log(`  Unique images loaded: ${imageBytes.size}`);
  console.log(`  WebP requests: ${webpCount}`);
  console.log(`  PNG requests: ${pngCount}`);
  console.log(`  After scroll down: ${requestsAfterScroll1}`);
  console.log(`  After scroll up: ${requestsAfterScroll2}`);
  console.log(`  After scroll down again: ${requestsAfterScroll3}`);
  console.log('');
  
  let duplicates = 0;
  for (const [url, count] of imageRequests.entries()) {
    if (count > 1) {
      duplicates += count - 1;
    }
  }
  
  console.log('Performance:');
  console.log(`  Total data transferred: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Average per image: ${imageBytes.size > 0 ? (totalBytes / imageBytes.size / 1024).toFixed(1) : 0} KB`);
  console.log(`  Duplicate requests: ${duplicates}`);
  console.log(`  Time to first render: ${afterInitialLoad - startTime}ms`);
  console.log('');
  
  // Issues
  if (pngCount > 0 && webpCount === 0) {
    console.log('❌ ISSUE: Using PNG instead of WebP (has_webp not working?)');
  } else if (webpCount > 0) {
    console.log('✅ WebP is being used');
  }
  
  if (duplicates > 0) {
    console.log(`❌ ISSUE: ${duplicates} duplicate image requests (images reloading)`);
  } else {
    console.log('✅ No duplicate requests - images cached properly');
  }
  
  if (requestsAfterScroll2 > requestsAfterScroll1 || requestsAfterScroll3 > requestsAfterScroll2) {
    console.log('❌ ISSUE: New requests after scrolling (lazy loading triggering reloads)');
  } else {
    console.log('✅ No new requests while scrolling (good)');
  }
  
  await page.screenshot({ path: '/tmp/local-board.png', fullPage: true });
  console.log('\n📸 Screenshot: /tmp/local-board.png\n');
});
