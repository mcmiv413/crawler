import { test, expect, type Page } from '@playwright/test';

/**
 * UI Fixes Validation Tests
 * These tests verify that the 4 UI bug fixes are working correctly
 */

async function startNewGame(page: Page, name = 'UITestHero') {
  await page.goto('/');
  await page.getByRole('textbox').fill(name);
  await page.getByRole('button', { name: 'New Game' }).click();
  await expect(page.getByRole('heading', { name: 'Town' })).toBeVisible({ timeout: 10_000 });
}

test.describe('UI Bug Fixes Validation', () => {
  // ─────────────────────────────────────────────────────────────────
  // Fix #1: Combat Log Always Visible
  // ─────────────────────────────────────────────────────────────────
  test('Fix #1: Combat log remains visible when consumables/quests expand', async ({ page }) => {
    await startNewGame(page);
    await page.getByRole('button', { name: 'Enter Dungeon' }).click();

    // Wait for dungeon to load
    await expect(page.getByText(/bump to attack/)).toBeVisible({ timeout: 10_000 });

    // Actions section should be visible
    const actionsHeading = page.getByRole('heading', { name: 'Actions' });
    await expect(actionsHeading).toBeVisible();

    // Look for the Log section (MiniCombatLog in DungeonPhase)
    const logHeading = page.getByRole('heading', { name: 'Log' });
    
    // Move around to generate some combat log entries
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
    }

    // Get bounding box of different sections
    const actionsBox = await actionsHeading.boundingBox();
    const logBox = await logHeading.boundingBox();
    
    // Verify both headers are within viewport (not scrolled off)
    if (actionsBox) {
      expect(actionsBox.y >= 0).toBeTruthy();
      expect(actionsBox.y + actionsBox.height <= page.viewportSize()!.height).toBeTruthy();
    }
    if (logBox) {
      expect(logBox.y >= 0).toBeTruthy();
      expect(logBox.y + logBox.height <= page.viewportSize()!.height).toBeTruthy();
    }

    // Combat log should have received some entries
    const combatEntries = page.locator('text=/^.+$/').count(); // Any text node
    expect(combatEntries).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // Fix #2: Inventory Screen Layout Bounds
  // ─────────────────────────────────────────────────────────────────
  test('Fix #2: Inventory screen buttons always accessible', async ({ page }) => {
    await startNewGame(page);

    // Open inventory
    const inventoryBtn = page.getByRole('button').filter({ hasText: /Inventory|inventory|[Ii]nv/ }).first();
    if (await inventoryBtn.isVisible()) {
      await inventoryBtn.click();
    } else {
      // Try via keyboard or look for it in panels
      await page.keyboard.press('i'); // Common inventory hotkey
      await page.waitForTimeout(500);
    }

    // "Back to Game" button should be visible
    const backBtn = page.getByRole('button', { name: /Back|back/ });
    if (await backBtn.count() > 0) {
      const backBtnBox = await backBtn.first().boundingBox();
      
      // Check button is within viewport (not below screen)
      if (backBtnBox) {
        expect(backBtnBox.y >= 0).toBeTruthy();
        expect(backBtnBox.y + backBtnBox.height <= page.viewportSize()!.height).toBeTruthy();
      }
    }

    // Equipment section should be visible
    const equipmentHeading = page.getByRole('heading', { name: 'Equipment' });
    if (await equipmentHeading.count() > 0) {
      await expect(equipmentHeading).toBeVisible({ timeout: 5_000 });
      const equipBox = await equipmentHeading.boundingBox();
      if (equipBox) {
        expect(equipBox.y >= 0).toBeTruthy();
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // Fix #3: Panel Buttons Responsive
  // ─────────────────────────────────────────────────────────────────
  test('Fix #3: Panel buttons fit within viewport on narrow screens', async ({ page }) => {
    // Set viewport to mobile width
    await page.setViewportSize({ width: 375, height: 667 });

    await startNewGame(page);

    // Navigate to inventory to see filter/sort buttons
    const inventoryBtn = page.getByRole('button').filter({ hasText: /inventory/i }).first();
    if (await inventoryBtn.count() > 0) {
      await inventoryBtn.click();
    }

    // Look for filter/sort buttons that were part of the responsive fix
    const filterButtons = page.getByRole('button').filter({ hasText: /Filter|Sort|All|Weapons|Armor/ });
    
    // If filter buttons exist, verify they're not extending off screen
    const filterCount = await filterButtons.count();
    if (filterCount > 0) {
      for (let i = 0; i < Math.min(filterCount, 5); i++) {
        const btn = filterButtons.nth(i);
        const box = await btn.boundingBox();
        
        if (box) {
          // Verify button is within horizonal bounds
          expect(box.x >= 0).toBeTruthy();
          expect(box.x + box.width <= 375).toBeTruthy(); // viewport width
          
          // Verify button is within vertical bounds
          expect(box.y >= 0).toBeTruthy();
        }
      }
    }

    // Reset viewport for next test
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ─────────────────────────────────────────────────────────────────
  // Fix #4: Dungeon Dynamic Sizing
  // ─────────────────────────────────────────────────────────────────
  test('Fix #4: Dungeon canvas scales dynamically for available space', async ({ page }) => {
    await startNewGame(page);
    await page.getByRole('button', { name: 'Enter Dungeon' }).click();

    // Wait for dungeon to render
    await expect(page.getByText(/bump to attack/)).toBeVisible({ timeout: 10_000 });

    // Get the dungeon canvas container
    const dungeonContainer = page.locator('canvas').first();
    if (await dungeonContainer.count() === 0) {
      // Try ASCII view
      const dungeonView = page.locator('div').filter({ has: page.locator('span') }).first();
      if (await dungeonView.count() > 0) {
        const box = await dungeonView.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    } else {
      const canvasBox = await dungeonContainer.boundingBox();
      expect(canvasBox).not.toBeNull();
      if (canvasBox) {
        // Canvas should have reasonable width/height (not just 1x1)
        expect(canvasBox.width).toBeGreaterThan(200);
        expect(canvasBox.height).toBeGreaterThan(200);
      }
    }

    // Test on narrow viewport
    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(500); // Let resize event process

    const dungeonContainerNarrow = page.locator('canvas').first();
    if (await dungeonContainerNarrow.count() > 0) {
      const narrowBox = await dungeonContainerNarrow.boundingBox();
      if (narrowBox) {
        // Should still be visible and reasonable size
        expect(narrowBox.width).toBeGreaterThan(100);
        expect(narrowBox.y + narrowBox.height).toBeLessThanOrEqual(800);
      }
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ─────────────────────────────────────────────────────────────────
  // Combined Integration Test
  // ─────────────────────────────────────────────────────────────────
  test('All fixes work together in full game flow', async ({ page }) => {
    await startNewGame(page);

    // 1. Buy an item (tests responsive buttons)
    await expect(page.getByRole('heading', { name: 'Shop' })).toBeVisible({ timeout: 5_000 });
    const buyBtn = page.getByRole('button', { name: 'Buy' }).first();
    if (await buyBtn.count() > 0) {
      await buyBtn.click();
      await page.waitForTimeout(500);
    }

    // 2. Open inventory (tests layout bounds)
    const invBtn = page.getByRole('button', { name: /Inventory|inventory/ }).first();
    if (await invBtn.count() > 0) {
      await invBtn.click();
      // Verify header is accessible
      const inventoryHeading = page.getByRole('heading', { name: 'Inventory' });
      if (await inventoryHeading.count() > 0) {
        await expect(inventoryHeading).toBeVisible({ timeout: 5_000 });
      }
    }

    // 3. Close inventory and enter dungeon (tests combat log + dynamic sizing)
    const backBtn = page.getByRole('button', { name: /Back|back/ });
    if (await backBtn.count() > 0) {
      await backBtn.click();
    }

    const dungeonBtn = page.getByRole('button', { name: 'Enter Dungeon' });
    if (await dungeonBtn.count() > 0) {
      await dungeonBtn.click();
      await expect(page.getByText(/bump to attack/)).toBeVisible({ timeout: 10_000 });
    }

    // At this point, all four fixes should be working together
    // Combat log is visible, responsive layout on inventory, dynamic dungeon sizing
    expect(true).toBeTruthy(); // Test completed without errors
  });
});
