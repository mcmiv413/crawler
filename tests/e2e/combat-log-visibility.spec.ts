import { test, expect } from '@playwright/test';

async function startNewGame(page, viewport = { width: 1200, height: 800 }) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.getByRole('textbox').fill('TestHero');
  await page.getByRole('button', { name: 'New Game' }).click();
  await expect(page.getByRole('heading', { name: 'Town' })).toBeVisible({ timeout: 10_000 });
}

test.describe('Combat Log Visibility', () => {
  test('Desktop: Combat log section exists in DOM structure', async ({ page }) => {
    await startNewGame(page);
    
    // Enter dungeon
    await page.getByRole('button', { name: 'Enter Dungeon' }).click();
    
    // Wait for dungeon phase to render - look for "Actions" label which is always in DOM
    await expect(page.getByText('Actions')).toBeVisible({ timeout: 10_000 });
    
    // Check if MiniCombatLog container is in the DOM
    // It should have a border-top and be a flexShrink: 0 element
    const dungeonPhaseContainer = page.locator('h2:has-text("Dungeon")').locator('..').locator('..');
    
    // Get all div elements under dungeon phase
    const allDivs = dungeonPhaseContainer.locator('div');
    const divCount = await allDivs.count();
    console.log('Total divs in DungeonPhase:', divCount);
    
    // Look for elements that might contain combat log entries
    const miniCombatLogElements = page.locator(`text=/^.+dmg|loot|death/`).all();
    const count = (await miniCombatLogElements).length;
    console.log('Combat log entry elements found:', count);
    
    // Check that the component structure includes scrollable section followed by fixed combat log
    // The desktop layout has: Header, HUD, Map, Swap button, then Bottom panel with Actions (scrollable) and Combat log (fixed)
    const bottomPanelExists = await page.evaluate(() => {
      const dungeonHeading = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('Dungeon'));
      if (!dungeonHeading) return { found: false, reason: 'No Dungeon heading' };
      
      const dungeonPhase = dungeonHeading.closest('div');
      if (!dungeonPhase) return { found: false, reason: 'No DungeonPhase container' };
      
      // Look for the bottom panel structure: flex: 0.5, minHeight: 160, maxHeight: 300
      const allDivs = dungeonPhase.querySelectorAll('div');
      let foundBottomPanel = false;
      let foundFixedCombatLog = false;
      
      for (const div of allDivs) {
        const style = window.getComputedStyle(div);
        const textContent = div.textContent || '';
        
        // Bottom panel should have specific flex properties
        if (style.flex && style.flex.includes('0.5')) {
          foundBottomPanel = true;
          console.log('Found bottom panel with flex: 0.5');
        }
        
        // Combat log section should be flexShrink: 0 (or flex-shrink: 0)
        if (style.flexShrink === '0' && textContent.length < 500) {
          const hasChildren = div.children.length > 0;
          if (hasChildren) {
            foundFixedCombatLog = true;
            console.log('Found fixed combat log section');
          }
        }
      }
      
      return { found: foundBottomPanel && foundFixedCombatLog, reason: `Bottom panel: ${foundBottomPanel}, Fixed log: ${foundFixedCombatLog}` };
    });
    
    console.log('Desktop layout structure check:', bottomPanelExists);
    expect(bottomPanelExists.found).toBeTruthy();
  });

  test('Mobile: Combat log fixed above tab bar', async ({ page }) => {
    await startNewGame(page, { width: 375, height: 667 });
    
    // Enter dungeon
    await page.getByRole('button', { name: 'Enter Dungeon' }).click();
    
    // Wait for dungeon phase to render
    await expect(page.getByText('Actions')).toBeVisible({ timeout: 10_000 });
    
    // Check mobile layout: scrollable middle with fixed combat log footer
    const mobileLayout = await page.evaluate(() => {
      const dungeonHeading = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('Dungeon'));
      if (!dungeonHeading) return { found: false, reason: 'No Dungeon heading' };
      
      const dungeonPhase = dungeonHeading.closest('div');
      if (!dungeonPhase) return { found: false, reason: 'No DungeonPhase container' };
      
      // Mobile layout should have:
      // - A scrollable middle section (flex: 1, minHeight: 0, overflow: 'auto')
      // - A fixed combat log footer (flexShrink: 0, maxHeight: 80)
      
      let foundScrollableMiddle = false;
      let foundFixedCombatLog = false;
      
      const allDivs = dungeonPhase.querySelectorAll('div');
      for (const div of allDivs) {
        const style = window.getComputedStyle(div);
        
        // Scrollable middle
        if (style.flex === '1' && style.minHeight === '0px' && style.overflow === 'auto') {
          console.log('Found scrollable middle section');
          foundScrollableMiddle = true;
        }
        
        // Fixed combat log (maxHeight: 80, flexShrink: 0)
        if (style.flexShrink === '0' && style.maxHeight === '80px') {
          console.log('Found fixed combat log with maxHeight: 80px');
          foundFixedCombatLog = true;
        }
      }
      
      return { found: foundScrollableMiddle && foundFixedCombatLog, reason: `Scrollable: ${foundScrollableMiddle}, Fixed log: ${foundFixedCombatLog}` };
    });
    
    console.log('Mobile layout structure check:', mobileLayout);
    expect(mobileLayout.found).toBeTruthy();
  });
});
