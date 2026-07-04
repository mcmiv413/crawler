import { expect, test } from '@playwright/test';
import { huntDangerousEnemy } from '../../packages/content/src/quests/hunt-dangerous-enemy.js';
import { createInitialWorldState } from '../../packages/game-core/src/state/world-state.js';
import { SeededRNG } from '../../packages/game-core/src/utils/rng.js';
import { createQuestFromTemplate } from '../../packages/game-core/src/systems/quest-selection.js';
import { expectDungeonCanvasVisible } from './support/layout.js';
import { ScenarioPage } from './support/scenario-page.js';
import type { ScenarioCommandResponse } from './support/scenario-page.js';

function combatLog(page: import('@playwright/test').Page) {
  return page.locator(
    '[data-testid="combat-log"]:visible, [data-testid="combat-log-entries"]:visible',
  );
}

function numericHudValue(text: string, pattern: RegExp, label: string): number {
  const match = text.match(pattern);
  if (match?.[1] === undefined) {
    throw new Error(`Could not read ${label} from compact HUD: ${text}`);
  }
  return Number.parseInt(match[1], 10);
}

test('@smoke new game creation shows the town and named character', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const createResponsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && /\/api\/games\/?$/u.test(response.url()),
  );
  await page.getByRole('textbox').fill('Scenario Explorer');
  await page.getByRole('button', { name: 'Start New Game' }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBe(true);
  const created = await createResponse.json() as { readonly gameId?: unknown };
  expect(typeof created.gameId).toBe('string');
  await expect(page.getByTestId('town-view')).toBeVisible();
  await expect(page.getByText('Scenario Explorer', { exact: true })).toBeVisible();
});

test('scenario fresh game assigns a quest, enters the dungeon, and retreats', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'fresh-game-town-test', 'desktop-default', {
    expectedPhase: 'town',
    prepareState: state => ({
      ...state,
      phase: 'town',
      run: null,
      world: {
        ...state.world,
        npcs: createInitialWorldState(new SeededRNG(404)).npcs,
      },
      player: {
        ...state.player,
        floor: 0,
        position: { x: 0, y: 0 },
      },
    }),
  });

  const questResponsePromise = scenario.waitForCommand('TOWN_ACTION');
  const informantCard = page.getByText('Scratch', { exact: true }).locator('../..');
  await informantCard.getByRole('button', { name: 'Talk' }).click();
  const questResult = await scenario.commandJson(await questResponsePromise, 'TOWN_ACTION');
  expect(questResult.events).toContainEqual(expect.objectContaining({ type: 'QUEST_ASSIGNED' }));
  await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible();
  await page.getByRole('button', { name: 'Accept Quest' }).click();

  await page.getByTestId('mobile-nav-character').click();
  await expect(page.getByRole('button', { name: /Quests \(1\)/u })).toBeVisible();
  await page.getByTestId('mobile-nav-main').click();

  const enterResponsePromise = scenario.waitForCommand('TOWN_ACTION');
  await page.getByRole('button', { name: 'Enter Dungeon' }).click();
  const enterResult = await scenario.commandJson(await enterResponsePromise, 'TOWN_ACTION');
  expect(enterResult.events).toContainEqual(expect.objectContaining({ type: 'RUN_STARTED' }));
  await expect(page.getByTestId('dungeon-view')).toBeVisible();
  await expectDungeonCanvasVisible(page);

  await scenario.actionButton('Stairs').click();
  const retreatResponsePromise = scenario.waitForCommand('RETREAT');
  await page.getByRole('button', { name: /Return to Town/u }).click();
  const retreatResult = await scenario.commandJson(await retreatResponsePromise, 'RETREAT');
  expect(retreatResult.events).toContainEqual(expect.objectContaining({
    type: 'RUN_ENDED',
    reason: 'retreat',
  }));
  await expect(page.getByTestId('town-view')).toBeVisible();
});

test('scenario chest loot becomes visible in inventory and a potion can be used', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'inventory-chest-test', 'desktop-default');

  const interactResponsePromise = scenario.waitForCommand('INTERACT');
  await scenario.actionButton('Interact').click();
  await page.getByRole('button', { name: /Treasure Chest/u }).click();
  const interactResult = await scenario.commandJson(await interactResponsePromise, 'INTERACT');
  expect(interactResult.events).toContainEqual(expect.objectContaining({
    type: 'OBJECT_INTERACTED',
    gotLoot: true,
  }));
  const lootEvent = interactResult.events.find(event => event.type === 'LOOT_ACQUIRED');
  expect(lootEvent).toBeDefined();
  expect(typeof lootEvent?.['itemName']).toBe('string');

  await page.getByTestId('mobile-nav-inventory').click();
  const inventory = page.getByTestId('inventory-screen');
  await expect(inventory).toBeVisible();
  await inventory.getByTestId('inventory-bag-toggle').click();
  await expect(inventory.getByTestId('inventory-item-list')).toContainText(String(lootEvent?.['itemName']));
  await inventory.getByRole('button', { name: 'Back to Game' }).click();

  const useResponsePromise = scenario.waitForCommand('USE_ITEM');
  await scenario.actionButton('Use').click();
  await page.getByRole('button', { name: /Health Potion/u }).click();
  const useResult = await scenario.commandJson(await useResponsePromise, 'USE_ITEM');
  expect(useResult.events).toContainEqual(expect.objectContaining({ type: 'ITEM_USED' }));
  await expect(combatLog(page)).toContainText(/Used Health Potion/u);
});

test('scenario enemy kill shows level, gold, and quest-ready feedback', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'full-feature-e2e-test', 'desktop-default', {
    prepareState: state => ({
      ...state,
      activeQuests: [
        createQuestFromTemplate(huntDangerousEnemy, state.player.id, state.turnNumber),
      ],
    }),
  });
  const hud = page.getByTestId('compact-player-hud-bars').locator('..');
  const beforeHud = await hud.innerText();
  const beforeLevel = numericHudValue(beforeHud, /Lv\.(\d+)/u, 'level');
  const beforeGold = numericHudValue(beforeHud, /(\d+)g/u, 'gold');

  let attackResult: ScenarioCommandResponse | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const attackResponsePromise = scenario.waitForCommand('ATTACK');
    await scenario.actionButton('Attack').click();
    attackResult = await scenario.commandJson(await attackResponsePromise, 'ATTACK');
    if (attackResult.events.some(event => event.type === 'ENTITY_DIED')) {
      break;
    }
  }
  expect(attackResult?.events).toContainEqual(expect.objectContaining({ type: 'ENTITY_DIED' }));
  expect(attackResult?.events).toContainEqual(expect.objectContaining({ type: 'LEVEL_UP' }));
  expect(attackResult?.events).toContainEqual(expect.objectContaining({ type: 'GOLD_CHANGED' }));

  await expect(combatLog(page)).toContainText(/defeated/iu);
  await expect(combatLog(page)).toContainText(/Level up/iu);
  await expect(combatLog(page)).toContainText(/Gained .* gold/iu);
  await expect(combatLog(page)).toContainText(/Quest ready/iu);

  const afterHud = await hud.innerText();
  expect(numericHudValue(afterHud, /Lv\.(\d+)/u, 'level')).toBeGreaterThan(beforeLevel);
  expect(numericHudValue(afterHud, /(\d+)g/u, 'gold')).toBeGreaterThan(beforeGold);

  await page.getByTestId('mobile-nav-character').click();
  await page.getByRole('button', { name: /Quests \(1\)/u }).click();
  await expect(page.getByText('Ready to Turn In', { exact: true })).toBeVisible();
});

test('scenario equipped item persists across session reload', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'full-feature-e2e-test', 'desktop-default', {
    prepareState: state => ({
      ...state,
      run: state.run === null ? null : { ...state.run, enemies: new Map() },
    }),
  });

  await page.getByTestId('mobile-nav-inventory').click();
  const inventory = page.getByTestId('inventory-screen');
  await inventory.getByTestId('inventory-bag-toggle').click();
  const handAxeRow = inventory.getByTestId('inventory-item-list')
    .locator(':scope > div')
    .filter({ hasText: 'Hand Axe' });
  await expect(handAxeRow).toBeVisible();

  const equipResponsePromise = scenario.waitForCommand('EQUIP');
  await handAxeRow.getByRole('button', { name: 'Equip' }).click();
  await scenario.commandJson(await equipResponsePromise, 'EQUIP');
  await inventory.getByTestId('inventory-bag-toggle').click();
  await expect(inventory.getByText('Hand Axe (Off-hand)', { exact: true })).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('dungeon-view')).toBeVisible();
  const restoredGameId = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('dungeon-session');
    return raw === null ? null : (JSON.parse(raw) as { readonly gameId?: string }).gameId ?? null;
  });
  expect(restoredGameId).toBe(scenario.session.gameId);

  await page.getByTestId('mobile-nav-inventory').click();
  await expect(
    page.getByTestId('inventory-screen').getByText('Hand Axe (Off-hand)', { exact: true }),
  ).toBeVisible();
});

test('scenario ability UI casts Ember and shows combat feedback', async ({ page }) => {
  const scenario = await ScenarioPage.load(page, 'fire-spread-test', 'desktop-default');

  const abilityResponsePromise = scenario.waitForCommand('USE_ABILITY');
  await scenario.actionButton('Ability').click();
  await page.getByRole('button', { name: /Ember/u }).click();
  const abilityResult = await scenario.commandJson(await abilityResponsePromise, 'USE_ABILITY');
  expect(abilityResult.events).toContainEqual(expect.objectContaining({ type: 'ABILITY_USED' }));
  await expect(combatLog(page)).toContainText(/Ember|Used .* mana|damage/iu);
});
