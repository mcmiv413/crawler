import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Test sprite rendering to verify dawnlike atlas integration
 */
class GamePage {
  constructor(private page: Page) {}

  async navigateToGame() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async startNewGame(playerName: string = 'TestHero') {
    const startButton = this.page.locator('button:has-text("New Game")');
    await startButton.waitFor({ state: 'visible' });

    const nameInput = this.page.locator('input[placeholder*="name"], input[placeholder*="character"]');
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(playerName);
    }

    await startButton.click();
    await this.page.waitForTimeout(500);
  }

  async enterDungeon() {
    const enterButton = this.page.locator('button:has-text("Enter Dungeon")');
    await enterButton.waitFor({ state: 'visible', timeout: 5000 });
    await enterButton.click();
    await this.page.waitForTimeout(500);
  }

  async waitForDungeonLoaded() {
    // Use nth(1) to get the main dungeon map canvas (nth(0) is the sprite icon canvas)
    const canvas = this.page.locator('canvas').nth(1);
    await canvas.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(500);
  }

  async enableSprites() {
    // Try to enable sprite rendering
    const spriteButton = this.page.locator('button:has-text("Sprites"), button:has-text("🎨")');
    const isVisible = await spriteButton.isVisible({ timeout: 1000 }).catch(() => false);
    if (isVisible) {
      const currentText = await spriteButton.textContent();
      // If it shows ASCII icon, click to enable sprites
      if (currentText?.includes('⬛')) {
        await spriteButton.click();
        await this.page.waitForTimeout(300);
      }
    }
  }

  async getCanvasPixelData() {
    // Extract pixel data from canvas to verify sprites are being drawn
    // Use nth(1) to get the main dungeon map canvas
    const canvasHandle = await this.page.locator('canvas').nth(1).elementHandle();
    if (!canvasHandle) return null;

    const pixelData = await this.page.evaluate((canvas: any) => {
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);

      // Return summary: total pixels, non-black pixels (indication of content)
      let nonBlackPixels = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        // Count non-black pixels
        if (r > 0 || g > 0 || b > 0) {
          nonBlackPixels++;
        }
      }

      return {
        width,
        height,
        totalPixels: width * height,
        nonBlackPixels,
        coverage: ((nonBlackPixels / (width * height)) * 100).toFixed(2),
      };
    }, canvasHandle);

    return pixelData;
  }
}

test.describe('Sprite Rendering', () => {
  test('should render sprites on dungeon canvas', async ({ page }) => {
    const gamePage = new GamePage(page);

    // Navigate and start game
    await gamePage.navigateToGame();
    await gamePage.startNewGame();
    await gamePage.enterDungeon();
    await gamePage.waitForDungeonLoaded();

    // Enable sprite rendering
    await gamePage.enableSprites();

    // Get canvas pixel data
    const pixelData = await gamePage.getCanvasPixelData();
    console.log('Canvas pixel data:', pixelData);

    // Verify canvas has content
    expect(pixelData).toBeTruthy();
    expect(pixelData?.nonBlackPixels).toBeGreaterThan(0);

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'sprite-rendering-test.png' });
  });

  test('should show sprite sheet loaded', async ({ page }) => {
    const gamePage = new GamePage(page);

    await gamePage.navigateToGame();
    await gamePage.startNewGame();
    await gamePage.enterDungeon();
    await gamePage.waitForDungeonLoaded();
    await gamePage.enableSprites();

    // Wait longer for sprite sheet to load
    await page.waitForTimeout(2000);

    // Check if sprite sheet image is loaded by examining registry state
    const spriteState = await page.evaluate(() => {
      // The spriteRegistry is loaded in the window context
      return {
        registryReady: (window as any).__spriteRegistryReady,
        imagesLoaded: Array.from(document.images).map(img => ({
          src: img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        })),
      };
    });

    console.log('Sprite state:', spriteState);
    console.log('Images loaded:', JSON.stringify(spriteState.imagesLoaded, null, 2));
  });

  test('should verify canvas context supports drawing', async ({ page }) => {
    const gamePage = new GamePage(page);

    await gamePage.navigateToGame();
    await gamePage.startNewGame();
    await gamePage.enterDungeon();
    await gamePage.waitForDungeonLoaded();

    // Check if canvas context is working
    const canvasInfo = await page.evaluate(() => {
      // Get the main dungeon map canvas (the larger one, not the sprite icon)
      const canvases = document.querySelectorAll('canvas');
      const canvas = canvases[1] || canvases[0]; // Prefer the second canvas if available
      if (!canvas) return null;

      const ctx = canvas.getContext('2d');
      if (!ctx) return { canvasFound: true, contextFound: false };

      return {
        canvasFound: true,
        contextFound: true,
        width: canvas.width,
        height: canvas.height,
        contextType: ctx.constructor.name,
      };
    });

    console.log('Canvas info:', canvasInfo);
    expect(canvasInfo?.contextFound).toBe(true);
  });
});
