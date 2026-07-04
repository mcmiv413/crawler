import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

class GamePage {
  constructor(private readonly page: Page) {}

  async navigateToGame() {
    await this.page.addInitScript(() => {
      window.sessionStorage.clear();
      window.localStorage.clear();
    });
    await this.page.goto('/', { waitUntil: 'networkidle' });
  }

  async startNewGame(playerName: string = 'BeatTest') {
    const startButton = this.page.locator('button:has-text("New Game"), button:has-text("Start New Game")').first();
    await startButton.waitFor({ state: 'visible' });

    const nameInput = this.page.locator('input').first();
    await expect(nameInput).toBeVisible();
    await nameInput.clear();
    await nameInput.fill(playerName);

    await startButton.click();
    await this.page.waitForTimeout(500); // audit-allow-waitForTimeout: animation timing assertion
  }

  async waitForDungeonLoaded() {
    const enterDungeonButton = this.page.locator('button:has-text("Enter Dungeon")').first();
    await expect(enterDungeonButton).toBeVisible();
    await enterDungeonButton.click();

    const dungeonView = this.page.locator('canvas, .dungeon-phase, [data-testid="dungeon-view"]').first();
    await dungeonView.waitFor({ state: 'visible', timeout: 5000 });
  }
}

test('combat indicators retain player-first then enemy beat DOM order', async ({ page }) => {
  const gamePage = new GamePage(page);
  await gamePage.navigateToGame();
  await gamePage.startNewGame();
  await gamePage.waitForDungeonLoaded();

  await page.evaluate(() => {
    const emitIndicator = (text: string, delayMs: number, y: number) => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('combat-indicator', {
          detail: { x: 5, y, text, type: 'damage' },
        }));
      }, delayMs);
    };

    emitIndicator('BEAT-P', 50, 5);
    emitIndicator('BEAT-E1', 170, 6);
    emitIndicator('BEAT-E2', 290, 7);
  });

  await page.waitForTimeout(450); // audit-allow-waitForTimeout: animation timing assertion

  const indicatorTexts = await page.locator('div').evaluateAll((nodes) =>
    nodes
      .map((node) => node.textContent?.trim() ?? '')
      .filter((text) => text === 'BEAT-P' || text === 'BEAT-E1' || text === 'BEAT-E2'),
  );

  expect(indicatorTexts).toEqual(['BEAT-P', 'BEAT-E1', 'BEAT-E2']);
});
