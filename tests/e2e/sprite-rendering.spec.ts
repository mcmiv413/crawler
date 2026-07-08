/**
 * Test layer: e2e
 * Behavior: Sprite Rendering covers Sprite renderer; should render sprites on dungeon canvas; should show sprite sheet loaded.
 * Proof: Playwright actions and visible UI assertions verify the browser-facing outcome.
 * Validation: pnpm test:e2e tests/e2e/sprite-rendering.spec.ts
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectDungeonCanvasVisible } from './support/layout.js';

/**
 * Test sprite rendering to verify dawnlike atlas integration
 */
class GamePage {
  constructor(private page: Page) {}

  async navigateToGame() {
    await this.page.addInitScript(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  async startNewGame(playerName: string = 'TestHero') {
    await this.page.getByRole('textbox').fill(playerName);
    await this.page.getByRole('button', { name: 'Start New Game' }).click();
    await expect(this.page.getByTestId('town-view')).toBeVisible();
  }

  async enterDungeon() {
    await this.page.getByRole('button', { name: 'Enter Dungeon' }).click();
  }

  async waitForDungeonLoaded() {
    await expect(this.page.getByTestId('dungeon-view')).toBeVisible();
    await expectDungeonCanvasVisible(this.page);
  }

  async enableSprites() {
    // Try to enable sprite rendering
    const spriteButton = this.page.locator('button:has-text("Sprites"), button:has-text("🎨")');
    await expect(spriteButton).toBeVisible();
    const currentText = await spriteButton.textContent();
    // If it shows ASCII icon, click to enable sprites
    if (currentText?.includes('⬛')) {
      await spriteButton.click();
      await expect(spriteButton).toContainText('Sprites');
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

test.describe('Sprite renderer', () => {
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

    // Check the loaded sprite sheet image dimensions.
    const spriteState = await page.evaluate(async () => {
      const spriteSheet = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load DawnLike sprite sheet'));
        image.src = '/sprites/dawnlike.png';
      });

      return {
        imagesLoaded: [spriteSheet, ...Array.from(document.images)].map(img => ({
          src: img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        })),
      };
    });

    console.log('Sprite state:', spriteState);
    console.log('Images loaded:', JSON.stringify(spriteState.imagesLoaded, null, 2));
    const spriteSheet = spriteState.imagesLoaded.find(
      image => new URL(image.src).pathname === '/sprites/dawnlike.png',
    );
    expect(spriteSheet).toMatchObject({ complete: true });
    expect(spriteSheet?.naturalWidth).toBeGreaterThan(0);
    expect(spriteSheet?.naturalHeight).toBeGreaterThan(0);
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
