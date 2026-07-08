/**
 * Test layer: e2e
 * Behavior: Combat scenarios keep damage indicators, combat feedback, and chest-loot inventory rows visible on desktop and mobile while the healing indicator gap remains documented.
 * Proof: Assertions check visible damage indicator locators after ATTACK, ENTITY_DIED events, delayed indicator visibility, mobile combat-log text, LOOT_ACQUIRED itemName, and inventory item-list text containing that loot.
 * Validation: pnpm test:e2e tests/e2e/combat-indicators.spec.ts
 */
import { expect, test } from '@playwright/test';

import {
  expectActionAreaReachable,
  expectCombatLogReachable,
  expectDungeonCanvasVisible,
  expectMobileNavVisibleWhenExpected,
  expectNoDocumentOverflow,
} from './support/layout.js';
import { ScenarioPage } from './support/scenario-page.js';

function damageIndicators(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="combat-indicator"], .combat-indicator')
    .filter({ hasText: /^-\d+$|^miss$/iu });
}

function healIndicators(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="combat-indicator"], .combat-indicator')
    .filter({ hasText: /^\+\d+$/u });
}

test('scenario enemy attack shows a visible damage combat indicator', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'enemy-death-test', 'desktop-default');
  const attackResponsePromise = scenario.waitForCommand('ATTACK');

  await scenario.actionButton('Attack').click();

  await expect(damageIndicators(page).first()).toBeVisible();
  const attackResult = await scenario.commandJson(await attackResponsePromise, 'ATTACK');
  expect(attackResult.events).toContainEqual(expect.objectContaining({ type: 'ENTITY_DIED' }));
});

// Expected product gap: docs/bugs/healing-ability-no-visible-indicator.md
test.fixme('scenario healing ability shows a visible healing combat indicator', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'inventory-chest-test', 'desktop-default', {
    prepareState: state => ({
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: state.player.stats.maxHealth - 20 },
        abilities: [{ id: 'second_wind', cooldownRemaining: 0 }],
      },
    }),
  });
  const abilityResponsePromise = scenario.waitForCommand('USE_ABILITY');

  await scenario.actionButton('Ability').click();
  await page.getByRole('button', { name: 'Second Wind' }).click();

  await expect(healIndicators(page).first()).toBeVisible();
  const abilityResult = await scenario.commandJson(await abilityResponsePromise, 'USE_ABILITY');
  expect(abilityResult.events).toContainEqual(expect.objectContaining({
    type: 'ABILITY_USED',
    abilityId: 'second_wind',
  }));
});

test('scenario combat indicator remains visible through its documented display window', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'enemy-death-test', 'desktop-default');
  const attackResponsePromise = scenario.waitForCommand('ATTACK');
  await scenario.actionButton('Attack').click();
  const attackResult = await scenario.commandJson(await attackResponsePromise, 'ATTACK');
  expect(attackResult.events).toContainEqual(expect.objectContaining({ type: 'ENTITY_DIED' }));

  await page.waitForTimeout(200); // audit-allow-waitForTimeout: animation timing assertion
  await expect(damageIndicators(page).first()).toBeVisible();
  await page.waitForTimeout(550); // audit-allow-waitForTimeout: animation timing assertion
  await expect(damageIndicators(page).first()).toBeVisible();
});

test('layout scenario enemy attack keeps mobile controls and feedback reachable', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'enemy-death-test', 'ios-primary');

  await expectNoDocumentOverflow(page, 'ios-primary');
  await expectDungeonCanvasVisible(page);
  await expectMobileNavVisibleWhenExpected(page, 'ios-primary');
  await expectActionAreaReachable(page);

  const attackResponsePromise = scenario.waitForCommand('ATTACK');
  await scenario.actionButton('Attack').click();
  const attackResult = await scenario.commandJson(await attackResponsePromise, 'ATTACK');
  expect(attackResult.events).toContainEqual(expect.objectContaining({ type: 'ENTITY_DIED' }));
  await expectCombatLogReachable(page);
  await expect(page.locator(
    '[data-testid="combat-log"]:visible, [data-testid="combat-log-entries"]:visible',
  )).toContainText(/defeated|hit for|damage/iu);
});

test('layout scenario chest loot remains visible in the minimum mobile inventory', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'inventory-chest-test', 'ios-min');

  await expectNoDocumentOverflow(page, 'ios-min');
  await expectMobileNavVisibleWhenExpected(page, 'ios-min');

  const interactResponsePromise = scenario.waitForCommand('INTERACT');
  await scenario.actionButton('Interact').click();
  await page.getByRole('button', { name: /Treasure Chest/iu }).click();
  const interactResult = await scenario.commandJson(await interactResponsePromise, 'INTERACT');
  const lootEvent = interactResult.events.find(event => event.type === 'LOOT_ACQUIRED');
  expect(lootEvent).toBeDefined();
  expect(typeof lootEvent?.['itemName']).toBe('string');

  await page.getByTestId('mobile-nav-inventory').click();
  const inventory = page.getByTestId('inventory-screen');
  await expect(inventory).toBeVisible();
  await inventory.getByTestId('inventory-bag-toggle').click();
  await expect(inventory.getByTestId('inventory-item-list')).toContainText(String(lootEvent?.['itemName']));
});
