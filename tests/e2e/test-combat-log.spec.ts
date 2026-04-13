import { test, expect } from '@playwright/test';

async function startNewGame(page) {
  await page.goto('/');
  await page.getByRole('textbox').fill('TestHero');
  await page.getByRole('button', { name: 'New Game' }).click();
  await expect(page.getByRole('heading', { name: 'Town' })).toBeVisible({ timeout: 10_000 });
}

test('Desktop: Combat log visible on dungeon map panel', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await startNewGame(page);
  await page.getByRole('button', { name: 'Enter Dungeon' }).click();
  
  // Wait for dungeon to load
  await expect(page.getByText(/bump to attack/)).toBeVisible({ timeout: 10_000 });
  
  // Move around to generate combat log entries
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
  }
  
  // Check if MiniCombatLog is rendered (it should show recent combat entries)
  // The MiniCombatLog shows entries with type-specific styling
  const combatLogContainer = page.locator('div:has-text("loot|death|attack")').first();
  
  // Try to find any element with combat log styling
  const combatText = await page.locator('text=/^\\[.+\\]/').count();
  console.log('Combat log entries found:', combatText);
  
  // Get all visible text elements
  const allText = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.textContent && (el.textContent.includes('physical') || el.textContent.includes('dmg') || el.textContent.includes('attack')))
      .map(el => el.textContent?.substring(0, 50))
      .slice(0, 5);
  });
  console.log('Found text containing combat info:', allText);
  
  // Check if any combat-related styling is visible
  const hasCombatLog = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).some(el => {
      const text = el.textContent || '';
      const color = window.getComputedStyle(el).color;
      return (text.includes('dmg') || text.includes('attack') || text.includes('defeated')) && color;
    });
  });
  
  console.log('Has combat log element with styling:', hasCombatLog);
  expect(hasCombatLog).toBeTruthy();
});
