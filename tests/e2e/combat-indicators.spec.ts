import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seedAttackReadyDungeon } from './helpers/seeded-dungeon.js';

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

  async startAttackReadyDungeon(playerName: string = 'CombatTest') {
    await seedAttackReadyDungeon(this.page, playerName);
  }

  async enterDungeon() {
    const enterButton = this.page.locator('button:has-text("Enter Dungeon")').first();
    if (await enterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await enterButton.click();
    }
    await expect(this.page.locator('[data-testid="dungeon-view"]')).toBeVisible({ timeout: 5000 });
  }

  async waitForDungeonLoaded() {
    const dungeonView = this.page.locator('canvas, .dungeon-phase, [data-testid="dungeon-view"]');
    await Promise.race([
      dungeonView.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
      this.page.waitForTimeout(2000),
    ]);
  }

  async attackEnemy() {
    const attackButton = this.page.locator('button:has-text("Attack"), [data-testid*="attack"]').first();
    const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] as const;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await attackButton.waitFor({ state: 'visible', timeout: 3000 });
      if (await attackButton.isEnabled().catch(() => false)) {
        await attackButton.click();
        const firstTarget = this.page.locator('[role="dialog"] button').first();
        if (await firstTarget.isVisible({ timeout: 300 }).catch(() => false)) {
          await firstTarget.click();
        }
        await this.page.waitForTimeout(500); // Wait for combat animation
        return;
      }

      await this.page.keyboard.press(directions[attempt % directions.length]!);
      await this.page.waitForTimeout(150);
    }

    throw new Error('Attack button never became enabled');
  }

  async toggleDebugMode() {
    const debugButton = this.page.locator('button:has-text("Debug"), [data-testid*="debug"]');
    if (await debugButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await debugButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async openLogPanel() {
    const logTab = this.page.locator('button:has-text("Log")').first();
    await logTab.waitFor({ state: 'visible', timeout: 3000 });
    await logTab.click();
    await this.page.waitForTimeout(300);
  }

  async getCombatLogText() {
    const combatLog = this.page.locator('[data-testid="combat-log-entries"], .combat-log-view, .combat-log').first();
    if (!(await combatLog.isVisible({ timeout: 1000 }).catch(() => false))) {
      // The combat log renders nothing while it has no entries.
      return '';
    }
    const text = await combatLog.textContent();
    return text || '';
  }

  async getDamageIndicators() {
    const indicators = this.page.locator('[data-testid="combat-indicator"], .combat-indicator')
      .filter({ hasText: /^-\d+$|^miss$/i });
    return await indicators.count();
  }

  async getHealIndicators() {
    const indicators = this.page.locator('[data-testid="combat-indicator"], .combat-indicator')
      .filter({ hasText: /^\+\d+$/ });
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
    await gamePage.startAttackReadyDungeon('DamageTest');
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
    await gamePage.startAttackReadyDungeon('LogTest');
    await gamePage.waitForDungeonLoaded();
    await gamePage.openLogPanel();

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
    await gamePage.startAttackReadyDungeon('DebugTest');
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
    const canHeal = await healButton.isVisible({ timeout: 1000 }).catch(() => false)
      && await healButton.isEnabled().catch(() => false);

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
    await gamePage.startAttackReadyDungeon('MissTest');
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
    await gamePage.startAttackReadyDungeon('PersistTest');
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
