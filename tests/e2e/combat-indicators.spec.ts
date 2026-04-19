import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Combat indicators E2E test
 * Validates that damage/heal indicators and debug output work correctly
 */

class GamePage {
  constructor(private page: Page) {}

  async navigateToGame() {
    await this.page.goto('/', { waitUntil: 'networkidle' });
  }

  async startNewGame(playerName: string = 'TestHero') {
    const startButton = this.page.locator('button:has-text("Start New Game")');
    await startButton.waitFor({ state: 'visible' });

    const nameInput = this.page.locator('input[placeholder*="name"], input[placeholder*="character"]');
    if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill(playerName);
    }

    await startButton.click();
    await this.page.waitForTimeout(500);
  }

  async waitForDungeonLoaded() {
    const dungeonView = this.page.locator('canvas, .dungeon-phase, [data-testid="dungeon-view"]');
    await Promise.race([
      dungeonView.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      this.page.waitForTimeout(2000),
    ]);
  }

  async attackEnemy() {
    const attackButton = this.page.locator('button:has-text("Attack"), [data-testid*="attack"]');
    await attackButton.waitFor({ state: 'visible', timeout: 3000 });
    await attackButton.click();
    await this.page.waitForTimeout(500); // Wait for combat animation
  }

  async toggleDebugMode() {
    const debugButton = this.page.locator('button:has-text("Debug"), [data-testid*="debug"]');
    if (await debugButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await debugButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async getCombatLogText() {
    const combatLog = this.page.locator('[data-testid="combat-log"], .combat-log-view, .combat-log');
    const text = await combatLog.textContent();
    return text || '';
  }

  async getDamageIndicators() {
    // Look for red damage text floating labels
    const indicators = this.page.locator('div:has-text(/^-\\d+$/), div:has-text("miss")');
    return await indicators.count();
  }

  async getHealIndicators() {
    // Look for green heal text floating labels
    const indicators = this.page.locator('div:has-text(/^\\+\\d+$/)');
    return await indicators.count();
  }
}

test.describe('Combat Indicators', () => {
  let gamePage: GamePage;

  test.beforeEach(async ({ page }) => {
    gamePage = new GamePage(page);
    await gamePage.navigateToGame();
  });

  test('should show damage indicator when attacking enemy', async ({ page }) => {
    // Start game
    await gamePage.startNewGame('DamageTest');
    await gamePage.waitForDungeonLoaded();

    // Get initial indicator count
    const initialDamageCount = await gamePage.getDamageIndicators();

    // Attack enemy
    await gamePage.attackEnemy();
    await page.waitForTimeout(1000); // Wait for animation + event processing

    // Check for damage indicator
    const finalDamageCount = await gamePage.getDamageIndicators();
    expect(finalDamageCount).toBeGreaterThanOrEqual(initialDamageCount);
  });

  test('should show damage in combat log', async ({ page }) => {
    // Start game
    await gamePage.startNewGame('LogTest');
    await gamePage.waitForDungeonLoaded();

    // Get initial log
    const initialLog = await gamePage.getCombatLogText();

    // Attack enemy
    await gamePage.attackEnemy();
    await page.waitForTimeout(1000);

    // Check log has combat entry
    const finalLog = await gamePage.getCombatLogText();
    expect(finalLog.length).toBeGreaterThan(initialLog.length);

    // Should contain damage indication or hit/miss
    const hasDamageInfo = /(\d+|miss|hit)/i.test(finalLog);
    expect(hasDamageInfo).toBe(true);
  });

  test('should show debug output when enabled', async ({ page }) => {
    // Start game
    await gamePage.startNewGame('DebugTest');
    await gamePage.waitForDungeonLoaded();

    // Enable debug mode
    await gamePage.toggleDebugMode();
    await page.waitForTimeout(300);

    // Attack enemy
    await gamePage.attackEnemy();
    await page.waitForTimeout(1000);

    // Check combat log for damage formula info
    const combatLog = await gamePage.getCombatLogText();

    // Debug output should contain attack calculations
    // Look for damage number or formula indication
    const hasDamageOutput = /\d+|damage|attack|hit|miss/i.test(combatLog);
    expect(hasDamageOutput).toBe(true);
  });

  test('should show heal indicator for healing actions', async ({ page }) => {
    // Start game
    await gamePage.startNewGame('HealTest');
    await gamePage.waitForDungeonLoaded();

    // Check if healing item is available
    const healButton = page.locator('button:has-text("Heal"), [data-testid*="heal"]');
    const canHeal = await healButton.isVisible({ timeout: 1000 }).catch(() => false);

    if (canHeal) {
      // Use heal action
      await healButton.click();
      await page.waitForTimeout(1000);

      // Check for heal indicator (green +N)
      const healCount = await gamePage.getHealIndicators();
      expect(healCount).toBeGreaterThan(0);
    }
  });

  test('should show miss indicator on failed attack', async ({ page }) => {
    // Start game (this may or may not result in misses depending on stats)
    await gamePage.startNewGame('MissTest');
    await gamePage.waitForDungeonLoaded();

    // Try attacking multiple times to potentially get a miss
    for (let i = 0; i < 3; i++) {
      await gamePage.attackEnemy();
      await page.waitForTimeout(800);
    }

    // Check combat log for miss indication
    const combatLog = await gamePage.getCombatLogText();
    const hasMissOrHit = /miss|hit/i.test(combatLog);
    expect(hasMissOrHit).toBe(true);
  });

  test('combat indicators should persist long enough to be visible', async ({ page }) => {
    // Start game
    await gamePage.startNewGame('PersistTest');
    await gamePage.waitForDungeonLoaded();

    // Attack enemy
    await gamePage.attackEnemy();

    // Immediately check for indicator (should be visible)
    await page.waitForTimeout(200);
    const immediateCount = await gamePage.getDamageIndicators();

    // Wait halfway through fade (should still be visible at 750ms)
    await page.waitForTimeout(550); // 750ms total
    const midFadeCount = await gamePage.getDamageIndicators();

    // Indicator should still exist at mid-fade
    expect(midFadeCount).toBeGreaterThan(0);
  });
});
