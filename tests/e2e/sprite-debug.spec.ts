/**
 * Test layer: e2e
 * Behavior: Sprite Debug covers sprite renderer diagnoses sprite loading issues.
 * Proof: Playwright actions and visible UI assertions verify the browser-facing outcome.
 * Validation: pnpm test:e2e tests/e2e/sprite-debug.spec.ts
 */
import { test, expect } from '@playwright/test';

test('sprite renderer diagnoses sprite loading issues', async ({ page }) => {
  // Navigate to game
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Start new game
  const newGameButton = page.getByRole('button', { name: 'Start New Game' });
  await newGameButton.waitFor({ state: 'visible' });
  await newGameButton.click();

  // Enter dungeon
  const enterButton = page.locator('button:has-text("Enter Dungeon")');
  await enterButton.waitFor({ state: 'visible', timeout: 5000 });
  await enterButton.click();

  // Wait for canvas to appear
  const canvas = page.locator('canvas').nth(1);
  await canvas.waitFor({ state: 'visible', timeout: 5000 });

  // Wait for the renderer to draw content.
  await expect.poll(async () => page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    const mainCanvas = canvases[1] || canvases[0];
    const context = mainCanvas?.getContext('2d');
    if (!mainCanvas || !context) return false;

    const imageData = context.getImageData(
      0,
      0,
      Math.min(100, mainCanvas.width),
      Math.min(100, mainCanvas.height),
    );
    return imageData.data.some((channel, index) => index % 4 !== 3 && channel > 0);
  }), { timeout: 5000 }).toBe(true);

  // Check network requests
  console.log('\n=== NETWORK REQUESTS ===');
  const requests = await page.evaluate(() => {
    // Check via Performance API
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return resources
      .filter(r => r.name.includes('sprite') || r.name.includes('dawn'))
      .map(r => ({
        name: r.name.split('/').pop(),
        duration: r.duration.toFixed(2) + 'ms',
        size: ((r.transferSize || 0) / 1024).toFixed(2) + 'KB',
        status: r.transferSize === 0 ? 'cached' : 'loaded',
      }));
  });

  console.log('Sprite-related requests:', requests);

  // Try to trigger sprite load and watch for errors
  console.log('\n=== CHECKING SPRITE LOAD ERROR ===');
  const errors = await page.evaluate(() => {
    return {
      consoleErrors: [],
      // Try to access fetch/XHR logs
      pendingRequests: [],
    };
  });

  // Manually check if dawnlike.png is accessible
  console.log('\n=== TESTING DIRECT IMAGE LOAD ===');
  const imageLoadTest = await page.evaluate(async () => {
    return new Promise<{ loaded: boolean; error: string | null; size: number }>((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        resolve({ loaded: false, error: 'timeout', size: 0 });
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        resolve({ loaded: true, error: null, size: img.naturalWidth * img.naturalHeight });
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve({ loaded: false, error: 'network error', size: 0 });
      };

      img.src = '/sprites/dawnlike.png';
    });
  });

  console.log('Direct image load test:', imageLoadTest);

  // Check canvas rendering state
  console.log('\n=== CANVAS RENDERING STATE ===');
  const canvasPixels = await page.evaluate(() => {
    const canvases = document.querySelectorAll('canvas');
    const mainCanvas = canvases[1] || canvases[0];
    if (!mainCanvas) return null;

    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, Math.min(100, mainCanvas.width), Math.min(100, mainCanvas.height));
    let colorCount = new Map<string, number>();

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const color = `rgb(${r},${g},${b})`;
      colorCount.set(color, (colorCount.get(color) || 0) + 1);
    }

    // Sort by frequency
    const topColors = Array.from(colorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      canvasSize: { width: mainCanvas.width, height: mainCanvas.height },
      sampledPixels: imageData.width * imageData.height,
      topColors: Object.fromEntries(topColors),
    };
  });

  console.log('Canvas color analysis:', canvasPixels);

  // Check if spriteName data is being passed through the view
  console.log('\n=== CHECKING VIEW DATA ===');
  const viewData = await page.evaluate(() => {
    // Access window's game state if exposed
    return {
      hasView: typeof (window as any).__gameView !== 'undefined',
      windowKeys: Object.keys(window).filter(k => k.includes('sprite') || k.includes('view') || k.includes('game')),
    };
  });

  console.log('Window data:', viewData);

  // Take screenshot for visual inspection
  await page.screenshot({ path: 'test-results/sprite-debug.png' });
  console.log('Screenshot saved to test-results/sprite-debug.png');

  // Assert that the image loaded successfully
  expect(imageLoadTest.loaded).toBe(true);

  // The canvas should NOT be mostly black if sprites are rendering correctly
  // If it is, the spriteName values aren't being found in the atlas
  const blackPixels = canvasPixels?.topColors['rgb(0,0,0)'] || 0;
  const totalPixels = canvasPixels?.sampledPixels ?? 0;
  expect(totalPixels).toBeGreaterThan(0);
  const blackPercentage = (blackPixels / totalPixels) * 100;
  console.log(`Black pixels: ${blackPixels}/${totalPixels} (${blackPercentage.toFixed(2)}%)`);
  expect(blackPercentage, 'canvas should not be mostly black when sprites render').toBeLessThanOrEqual(50);

  // Test if specific sprite names exist in the atlas
  console.log('\n=== TESTING SPRITE NAMES ===');
  const spriteNameTests = await page.evaluate(() => {
    // We need to test if sprite names can be found
    const testNames = [
      'skeleton',
      'enormous rat',
      'goblin',
      'day stone floor c',
      'darkbrick wall center',  // This might be wrong
      'dark brick wall center', // or this?
      'closed chest',
    ];

    return {
      notYetImplemented: 'Cannot test without exposing DAWNLIKE_ATLAS to window',
    };
  });

  console.log('Sprite name test note:', spriteNameTests);
});
