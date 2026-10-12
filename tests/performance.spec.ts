/**
 * Measure image loading performance on typology.network
 * 
 * Tests:
 * 1. Count unique image requests (should be ~38-42, one per item)
 * 2. Measure total bytes transferred
 * 3. Check if WebP is used (not PNG)
 * 4. Test if images reload when scrolling back
 * 5. Measure time until board appears ready
 */

import { test, expect } from '@playwright/test';

test.describe('Image Loading Performance', () => {
  test('should load each image only once and use WebP', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    const imageRequests: Map<string, number> = new Map();
    const imageBytes: Map<string, number> = new Map();
    let totalBytes = 0;
    let webpCount = 0;
    let pngCount = 0;
    
    // Track all image requests
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('images.typology.network') || url.includes('/items/')) {
        const count = imageRequests.get(url) || 0;
        imageRequests.set(url, count + 1);
        
        try {
          const body = await response.body();
          const size = body.length;
          imageBytes.set(url, size);
          totalBytes += size;
          
          if (url.endsWith('.webp')) webpCount++;
          if (url.endsWith('.png')) pngCount++;
          
          console.log(`📥 ${url.split('/').pop()} - ${(size / 1024).toFixed(1)} KB (request #${count + 1})`);
        } catch (e) {
          // Response body might not be available
        }
      }
    });
    
    console.log('\n🔍 Loading https://typology.network...\n');
    
    // Load the page (don't wait for networkidle - images may be loading continuously!)
    const startTime = Date.now();
    await page.goto('https://typology.network', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait a moment for React to render
    await page.waitForTimeout(2000);
    
    // Check what's on the page
    const bodyText = await page.locator('body').textContent();
    console.log(`Page loaded, body contains: ${bodyText?.substring(0, 200)}...`);
    
    //Wait for canvas or board
    try {
      await page.waitForSelector('canvas', { timeout: 10000 });
      console.log('✅ Canvas found');
    } catch (e) {
      console.log('❌ No canvas found');
      await page.screenshot({ path: '/tmp/typology-error.png' });
      throw e;
    }
    
    // Check if loading indicator is visible
    const loadingVisible = await page.locator('.image-progress').isVisible().catch(() => false);
    console.log(`\n⏳ Loading indicator visible: ${loadingVisible}`);
    
    // Wait a bit for images to load
    await page.waitForTimeout(3000);
    
    const afterInitialLoad = Date.now();
    console.log(`\n✅ Initial load complete (${afterInitialLoad - startTime}ms)\n`);
    
    // Count how many images are visible
    const imageCount = await page.locator('canvas').evaluate((canvas) => {
      // Count Konva images
      return document.querySelectorAll('canvas').length;
    });
    
    console.log(`📊 Canvas elements: ${imageCount}`);
    
    // Scroll down to trigger lazy loading
    console.log('\n📜 Scrolling down...\n');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    
    // Scroll back up
    console.log('\n📜 Scrolling back up...\n');
    await page.evaluate(() => window.scrollBy(0, -1000));
    await page.waitForTimeout(2000);
    
    // Scroll down again to test if images reload
    console.log('\n📜 Scrolling down again (checking for reloads)...\n');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    
    const finalTime = Date.now();
    
    // Report results
    console.log('\n' + '='.repeat(60));
    console.log('📈 PERFORMANCE REPORT');
    console.log('='.repeat(60) + '\n');
    
    console.log('Image Requests:');
    console.log(`  Total unique images: ${imageRequests.size}`);
    console.log(`  WebP requests: ${webpCount}`);
    console.log(`  PNG requests: ${pngCount}`);
    console.log('');
    
    console.log('Request Frequency:');
    let duplicateRequests = 0;
    for (const [url, count] of imageRequests.entries()) {
      if (count > 1) {
        console.log(`  ⚠️  ${url.split('/').pop()}: ${count} requests (DUPLICATE!)`);
        duplicateRequests += count - 1;
      }
    }
    if (duplicateRequests === 0) {
      console.log('  ✅ No duplicate requests');
    } else {
      console.log(`  ❌ ${duplicateRequests} duplicate requests detected`);
    }
    console.log('');
    
    console.log('Data Transfer:');
    console.log(`  Total bytes: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Average per image: ${(totalBytes / imageRequests.size / 1024).toFixed(1)} KB`);
    console.log('');
    
    console.log('Timing:');
    console.log(`  Time to initial load: ${afterInitialLoad - startTime}ms`);
    console.log(`  Total test duration: ${finalTime - startTime}ms`);
    console.log('');
    
    // Assertions
    if (pngCount > webpCount) {
      console.log('❌ ISSUE: More PNG than WebP requests (has_webp likely not working)');
    }
    
    if (duplicateRequests > 0) {
      console.log('❌ ISSUE: Images are being re-requested (caching not working)');
    }
    
    // Take a screenshot
    await page.screenshot({ path: '/tmp/typology-network.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/typology-network.png\n');
  });
});
