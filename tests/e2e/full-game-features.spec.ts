import { expect, test } from '@playwright/test';
import type { Page, Response } from '@playwright/test';

import { huntDangerousEnemy } from '../../packages/content/src/quests/hunt-dangerous-enemy.js';
import { createQuestFromTemplate } from '../../packages/game-core/src/systems/quest-selection.js';
import { expectDungeonCanvasVisible } from './support/layout.js';
import { ScenarioPage } from './support/scenario-page.js';

interface CommandEvent {
  readonly type: string;
  readonly itemName?: string;
  readonly gotLoot?: boolean;
}

interface CommandResponse {
  readonly events: readonly CommandEvent[];
}

function actionButton(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^${label}:`, 'u') });
}

function combatLog(page: Page) {
  return page.locator(
    '[data-testid="combat-log"]:visible, [data-testid="combat-log-entries"]:visible',
  );
}

function waitForCommand(page: Page, type: string): Promise<Response> {
  return page.waitForResponse(response => {
    if (response.request().method() !== 'POST' || !response.url().includes('/commands')) {
      return false;
    }

    const body = response.request().postData();
    if (body === null) {
      return false;
    }

    try {
      return (JSON.parse(body) as { readonly type?: string }).type === type;
    } catch {
      return false;
    }
  });
}

async function commandJson(response: Response): Promise<CommandResponse> {
  expect(response.ok()).toBe(true);
  return response.json() as Promise<CommandResponse>;
}

async function compactHudText(page: Page): Promise<string> {
  return page.getByTestId('compact-player-hud-bars').locator('..').innerText();
}

function numericHudValue(text: string, pattern: RegExp, label: string): number {
  const match = text.match(pattern);
  if (match?.[1] === undefined) {
    throw new Error(`Could not read ${label} from compact HUD: ${text}`);
  }
  return Number.parseInt(match[1], 10);
}

test('full game features: new game assigns a quest, enters a run, and retreats to town', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('textbox').fill('Scenario Explorer');
  await page.getByRole('button', { name: 'Start New Game' }).click();
  await expect(page.getByTestId('town-view')).toBeVisible();
  await expect(page.getByText('Scenario Explorer', { exact: true })).toBeVisible();

  const informantCard = page.getByText('Scratch', { exact: true }).locator('../..');
  await informantCard.getByRole('button', { name: 'Talk' }).click();
  await expect(page.getByRole('heading', { name: 'New Quest' })).toBeVisible();
  await page.getByRole('button', { name: 'Accept Quest' }).click();

  await page.getByTestId('mobile-nav-character').click();
  await expect(page.getByTestId('character-scroll-content')).toBeVisible();
  await expect(page.getByRole('button', { name: /Quests \(1\)/u })).toBeVisible();
  await page.getByTestId('mobile-nav-main').click();

  await page.getByRole('button', { name: 'Enter Dungeon' }).click();
  await expect(page.getByTestId('dungeon-view')).toBeVisible();
  await expectDungeonCanvasVisible(page);

  await actionButton(page, 'Stairs').click();
  await page.getByRole('button', { name: /Return to Town/u }).click();
  await expect(page.getByTestId('town-view')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enter Dungeon' })).toBeEnabled();
});

test('full game features: persisted chest loot reaches inventory and a potion is consumed', async ({ page }) => {
  await ScenarioPage.load(page, 'inventory-consumable-test', 'desktop-default');

  const interactResponsePromise = waitForCommand(page, 'INTERACT');
  await actionButton(page, 'Interact').click();
  await page.getByRole('button', { name: /Treasure Chest/u }).click();
  const interactResult = await commandJson(await interactResponsePromise);
  expect(interactResult.events).toContainEqual(expect.objectContaining({
    type: 'OBJECT_INTERACTED',
    gotLoot: true,
  }));
  const lootEvent = interactResult.events.find(event => event.type === 'LOOT_ACQUIRED');
  expect(lootEvent?.itemName).toBeTruthy();

  await page.getByTestId('mobile-nav-inventory').click();
  const inventory = page.getByTestId('inventory-screen');
  await inventory.getByTestId('inventory-bag-toggle').click();
  await expect(inventory.getByTestId('inventory-item-list')).toContainText(lootEvent!.itemName!);
  await inventory.getByRole('button', { name: 'Back to Game' }).click();

  const useResponsePromise = waitForCommand(page, 'USE_ITEM');
  await actionButton(page, 'Use').click();
  await page.getByRole('button', { name: /Health Potion/u }).click();
  const useResult = await commandJson(await useResponsePromise);
  expect(useResult.events).toContainEqual(expect.objectContaining({ type: 'ITEM_USED' }));
  await expect(combatLog(page)).toContainText(/Used Health Potion/u);
});

test('full game features: combat levels up, earns gold, advances a quest, equips gear, explores, and restores', async ({ page }) => {
  const scenario = await ScenarioPage.load(
    page,
    'full-feature-e2e-test',
    'desktop-default',
    {
      prepareState: state => ({
        ...state,
        activeQuests: [
          createQuestFromTemplate(
            huntDangerousEnemy,
            state.player.id,
            state.turnNumber,
          ),
        ],
      }),
    },
  );

  const beforeHud = await compactHudText(page);
  const beforeLevel = numericHudValue(beforeHud, /Lv\.(\d+)/u, 'level');
  const beforeGold = numericHudValue(beforeHud, /(\d+)g/u, 'gold');

  let enemyDefeated = false;
  for (let attempt = 0; attempt < 5 && !enemyDefeated; attempt += 1) {
    const attackResponsePromise = waitForCommand(page, 'ATTACK');
    await actionButton(page, 'Attack').click();
    const attackResult = await commandJson(await attackResponsePromise);
    enemyDefeated = attackResult.events.some(event => event.type === 'ENTITY_DIED');
  }
  expect(enemyDefeated).toBe(true);
  await expect(combatLog(page)).toContainText(/defeated/iu);
  await expect(combatLog(page)).toContainText(/Level up/iu);
  await expect(combatLog(page)).toContainText(/Gained .* gold/iu);
  await expect(combatLog(page)).toContainText(/Quest ready/iu);

  const afterHud = await compactHudText(page);
  expect(numericHudValue(afterHud, /Lv\.(\d+)/u, 'level')).toBeGreaterThan(beforeLevel);
  expect(numericHudValue(afterHud, /(\d+)g/u, 'gold')).toBeGreaterThan(beforeGold);

  await page.getByTestId('mobile-nav-character').click();
  await page.getByRole('button', { name: /Quests \(1\)/u }).click();
  await expect(page.getByText('Ready to Turn In', { exact: true })).toBeVisible();
  await expect(page.getByText(/Progress:/u)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();

  await page.getByTestId('mobile-nav-inventory').click();
  const inventory = page.getByTestId('inventory-screen');
  await inventory.getByTestId('inventory-bag-toggle').click();
  const handAxeRow = inventory.getByTestId('inventory-item-list')
    .locator(':scope > div')
    .filter({ hasText: 'Hand Axe' });
  const equipResponsePromise = waitForCommand(page, 'EQUIP');
  await handAxeRow.getByRole('button', { name: 'Equip' }).click();
  await commandJson(await equipResponsePromise);

  await inventory.getByTestId('inventory-bag-toggle').click();
  await expect(inventory.getByText(/Hand Axe/u)).toBeVisible();
  await inventory.getByRole('button', { name: 'Back to Game' }).click();

  const canvas = page.getByTestId('dungeon-canvas');
  const beforeMove = (await canvas.screenshot()).toString('base64');
  const moveResponsePromise = waitForCommand(page, 'MOVE');
  await page.keyboard.press('ArrowRight');
  const moveResult = await commandJson(await moveResponsePromise);
  expect(moveResult.events).toContainEqual(expect.objectContaining({ type: 'PLAYER_MOVED' }));
  await expect.poll(async () => (await canvas.screenshot()).toString('base64')).not.toBe(beforeMove);

  const storedGameId = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('dungeon-session');
    return raw === null ? null : (JSON.parse(raw) as { readonly gameId?: string }).gameId ?? null;
  });
  expect(storedGameId).toBe(scenario.session.gameId);
  const persistedHud = await compactHudText(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('dungeon-view')).toBeVisible();
  await expect(compactHudText(page)).resolves.toBe(persistedHud);
  const restoredGameId = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem('dungeon-session');
    return raw === null ? null : (JSON.parse(raw) as { readonly gameId?: string }).gameId ?? null;
  });
  expect(restoredGameId).toBe(storedGameId);

  await page.getByTestId('mobile-nav-inventory').click();
  await expect(page.getByTestId('inventory-screen').getByText(/Hand Axe/u)).toBeVisible();
});

test('full game features: a ring ability casts through the real action UI', async ({ page }) => {
  await ScenarioPage.load(page, 'fire-spread-test', 'desktop-default');

  const abilityResponsePromise = waitForCommand(page, 'USE_ABILITY');
  await actionButton(page, 'Ability').click();
  await page.getByRole('button', { name: /Ember/u }).click();
  const abilityResult = await commandJson(await abilityResponsePromise);
  expect(abilityResult.events).toContainEqual(expect.objectContaining({ type: 'ABILITY_USED' }));
  await expect(combatLog(page)).toContainText(/Ember|Used .* mana|damage/iu);
});
