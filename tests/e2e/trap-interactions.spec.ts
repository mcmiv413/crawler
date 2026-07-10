/**
 * Test layer: e2e
 * Behavior: Trap scenarios expose placement, trigger, disarm, status, lifecycle, animation, renderer-mode, rejection, and save/load behavior through the real command pipeline.
 * Proof: UI assertions drive SET_TRAP, MOVE, WAIT, and USE_ABILITY responses, verify trap events and animation IDs, check damage/status indicators, assert player-origin trap exhaustion survives restore, and reject invalid trap commands without success animations or turn consumption.
 * Validation: pnpm test:e2e:scenario (focused: pnpm test:e2e tests/e2e/trap-interactions.spec.ts)
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { E2E_API_BASE } from './support/api-base.js';
import { ScenarioPage } from './support/scenario-page.js';

type RendererMode = 'canvas' | 'three';

interface TrapEventLike {
  readonly type?: string;
  readonly [key: string]: unknown;
}

interface AnimatedEventLike {
  readonly type?: string;
  readonly data?: {
    readonly animationId?: string;
    readonly text?: string;
    readonly combatIndicators?: readonly {
      readonly text?: string;
      readonly x?: number;
      readonly y?: number;
    }[];
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

interface CommandViewLike {
  readonly animatedEvents?: readonly AnimatedEventLike[];
  readonly combatLog?: readonly { readonly text?: string }[];
  readonly player?: {
    readonly health?: number;
    readonly statuses?: readonly { readonly id?: string; readonly name?: string }[];
  };
  readonly map?: {
    readonly entities?: readonly {
      readonly type?: string;
      readonly templateId?: string | null;
      readonly x?: number;
      readonly y?: number;
    }[];
  };
}

interface TrapCommandResponse {
  readonly events: readonly TrapEventLike[];
  readonly view?: CommandViewLike;
  readonly serializedState: string;
}

interface RestoreResponseLike {
  readonly serializedState?: string;
}

const TRAP_SCENARIO = 'trap-interaction-test';
const TRAP_PLACEMENT_ANIMATION_ID = 'fx.utility.trap-placement';
const TRAP_DISARM_ANIMATION_ID = 'fx.impact.disarm-strike';
const TRAP_SPARK_ANIMATION_ID = 'fx.utility.trap-spark';

async function setRendererMode(page: Page, rendererMode: RendererMode): Promise<void> {
  await page.addInitScript((mode: RendererMode) => {
    const globalWindow = window as Window & {
      __DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__?: RendererMode;
      __DUNGEON_DEPTH_ATMOSPHERE_OVERRIDE__?: boolean;
      __DUNGEON_E2E__?: { enabled?: boolean };
    };
    globalWindow.__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__ = mode;
    globalWindow.__DUNGEON_DEPTH_ATMOSPHERE_OVERRIDE__ = false;
    globalWindow.__DUNGEON_E2E__ = { enabled: true };
  }, rendererMode);
}

function animationIds(result: TrapCommandResponse): readonly string[] {
  return (result.view?.animatedEvents ?? [])
    .map(event => event.data?.animationId)
    .filter((animationId): animationId is string => typeof animationId === 'string');
}

function combatIndicatorTexts(result: TrapCommandResponse): readonly string[] {
  return (result.view?.animatedEvents ?? []).flatMap(event => {
    const directText = event.type === 'damage' || event.type === 'heal' || event.type === 'status'
      ? event.data?.text
      : undefined;
    return [
      ...(typeof directText === 'string' ? [directText] : []),
      ...(event.data?.combatIndicators ?? [])
      .map(indicator => indicator.text)
      .filter((text): text is string => typeof text === 'string'),
    ];
  });
}

function combatLogText(result: TrapCommandResponse): string {
  return (result.view?.combatLog ?? [])
    .map(entry => entry.text ?? '')
    .join('\n');
}

function eventOfType(
  result: TrapCommandResponse,
  type: string,
): TrapEventLike {
  const event = result.events.find(candidate => candidate.type === type);
  expect(event, `expected ${type} in ${result.events.map(candidate => candidate.type ?? 'unknown').join(', ')}`).toBeDefined();
  return event!;
}

function playerOriginTrapFromSerializedState(serializedState: string): Record<string, unknown> {
  const parsed = JSON.parse(serializedState) as {
    readonly run?: {
      readonly objects?: Record<string, Record<string, unknown>>;
    } | null;
  };
  const trap = parsed.run?.objects?.['3,1'];
  expect(trap).toBeDefined();
  return trap!;
}

function trapItemEntityIdFromSerializedState(serializedState: string, templateId: string): string {
  const parsed = JSON.parse(serializedState) as {
    readonly player?: { readonly inventory?: readonly string[] };
    readonly itemRegistry?: {
      readonly items?: Record<string, { readonly itemId?: string; readonly templateId?: string }>;
    };
  };
  const inventory = parsed.player?.inventory ?? [];
  const items = parsed.itemRegistry?.items ?? {};
  const entityId = inventory.find((candidate) => {
    const item = items[candidate];
    return item?.itemId === templateId || item?.templateId === templateId;
  });
  expect(entityId, `expected ${templateId} in scenario inventory`).toBeDefined();
  return entityId!;
}

async function postCommand(
  page: Page,
  scenario: ScenarioPage,
  command: Record<string, unknown>,
): Promise<TrapCommandResponse> {
  const response = await page.request.post(`${E2E_API_BASE}/games/${scenario.session.gameId}/commands`, {
    headers: {
      'X-Dungeon-Session': scenario.session.sessionToken,
    },
    data: command,
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<TrapCommandResponse>;
}

async function restoreSerializedState(
  page: Page,
  scenario: ScenarioPage,
  serializedState: string,
): Promise<string> {
  const response = await page.request.post(`${E2E_API_BASE}/games/restore`, {
    headers: {
      'X-Dungeon-Session': scenario.session.sessionToken,
    },
    data: { serializedState },
  });
  expect(response.ok()).toBe(true);
  const body = await response.json() as RestoreResponseLike;
  expect(typeof body.serializedState).toBe('string');
  return body.serializedState!;
}

for (const rendererMode of ['canvas', 'three'] as const) {
  test(`trap scenario supports placement, enemy trigger, and save/load in ${rendererMode} mode`, async ({ page }) => {
    await setRendererMode(page, rendererMode);
    const scenario = await ScenarioPage.load(page, TRAP_SCENARIO, 'desktop-default');

    await scenario.actionButton('Ability').click();
    await expect(page.getByRole('button', { name: /Set Trap/iu })).toBeVisible();
    await expect(page.getByRole('button', { name: /Disarm Trap/iu })).toBeVisible();

    await page.getByRole('button', { name: /Set Trap/iu }).click();
    await expect(page.getByRole('button', { name: /Wooden Spike Trap/iu })).toBeVisible();
    await page.getByRole('button', { name: /Wooden Spike Trap/iu }).click();

    const placeResponsePromise = scenario.waitForCommand('SET_TRAP');
    await page.getByRole('button', { name: '↓' }).click();
    const placeResult = await scenario.commandJson(await placeResponsePromise, 'SET_TRAP') as TrapCommandResponse;
    expect(eventOfType(placeResult, 'TRAP_PLACED')).toEqual(expect.objectContaining({
      position: { x: 1, y: 2 },
      trapTemplateId: 'trap_spikes',
    }));
    expect(animationIds(placeResult)).toContain(TRAP_PLACEMENT_ANIMATION_ID);
    expect(placeResult.view?.map?.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'object',
        templateId: 'trap_spikes',
        x: 1,
        y: 2,
      }),
    ]));
    expect(combatLogText(placeResult)).toMatch(/placed/i);

    const playerTrapBeforeTrigger = playerOriginTrapFromSerializedState(placeResult.serializedState);
    expect(playerTrapBeforeTrigger).toEqual(expect.objectContaining({
      templateId: 'trap_spikes',
      origin: 'player',
      isExhausted: false,
    }));

    const enemyTriggerResponsePromise = scenario.waitForCommand('WAIT');
    await scenario.actionButton('Wait').click();
    const enemyTriggerResult = await scenario.commandJson(await enemyTriggerResponsePromise, 'WAIT') as TrapCommandResponse;
    expect(eventOfType(enemyTriggerResult, 'TRAP_TRIGGERED')).toEqual(expect.objectContaining({
      trapName: expect.stringMatching(/spike trap/iu),
      hazardType: 'spike',
      trapOrigin: 'player',
      exhausted: true,
      targetName: 'Skeleton Warrior',
      targetPosition: { x: 3, y: 1 },
    }));
    expect(animationIds(enemyTriggerResult)).toContain(TRAP_SPARK_ANIMATION_ID);
    expect(combatIndicatorTexts(enemyTriggerResult)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^-\d+$/u),
    ]));

    const playerTrapAfterTrigger = playerOriginTrapFromSerializedState(enemyTriggerResult.serializedState);
    expect(playerTrapAfterTrigger).toEqual(expect.objectContaining({
      templateId: 'trap_spikes',
      origin: 'player',
      isExhausted: true,
    }));

    const restoredSerializedState = await restoreSerializedState(page, scenario, enemyTriggerResult.serializedState);
    expect(playerOriginTrapFromSerializedState(restoredSerializedState)).toEqual(expect.objectContaining({
      origin: 'player',
      isExhausted: true,
    }));
  });

  test(`trap scenario applies player-triggered trap status in ${rendererMode} mode`, async ({ page }) => {
    await setRendererMode(page, rendererMode);
    const scenario = await ScenarioPage.load(page, TRAP_SCENARIO, 'desktop-default');

    const playerTriggerResponsePromise = scenario.waitForCommand('MOVE');
    await page.keyboard.press('ArrowRight');
    const playerTriggerResult = await scenario.commandJson(await playerTriggerResponsePromise, 'MOVE') as TrapCommandResponse;
    const playerTrapEvent = eventOfType(playerTriggerResult, 'TRAP_TRIGGERED');
    expect(playerTrapEvent).toEqual(expect.objectContaining({
      trapName: expect.stringMatching(/poison trap/iu),
      hazardType: 'poison',
      trapOrigin: 'environment',
      exhausted: false,
      statusEffect: 'poison',
      targetName: 'Hero',
      targetPosition: { x: 2, y: 1 },
    }));
    expect(playerTriggerResult.events).toContainEqual(expect.objectContaining({
      type: 'STATUS_APPLIED',
      targetId: playerTrapEvent.targetId,
      statusId: 'poison',
      sourceId: playerTrapEvent.trapId,
    }));
    expect(animationIds(playerTriggerResult)).toContain(TRAP_SPARK_ANIMATION_ID);
    expect(combatIndicatorTexts(playerTriggerResult)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^-\d+$/u),
    ]));
    expect(playerTriggerResult.view?.player?.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'poison' }),
    ]));
  });

  test(`trap scenario disarms an adjacent trap in ${rendererMode} mode`, async ({ page }) => {
    await setRendererMode(page, rendererMode);
    const scenario = await ScenarioPage.load(page, TRAP_SCENARIO, 'desktop-default');

    await scenario.actionButton('Ability').click();
    await page.getByRole('button', { name: /Disarm Trap/iu }).click();
    const disarmResponsePromise = scenario.waitForCommand('USE_ABILITY');
    await page.getByRole('button', { name: /Spike Trap/iu }).click();
    const disarmResult = await scenario.commandJson(await disarmResponsePromise, 'USE_ABILITY') as TrapCommandResponse;
    expect(eventOfType(disarmResult, 'TRAP_DISARMED')).toEqual(expect.objectContaining({
      position: { x: 1, y: 0 },
      trapName: expect.stringMatching(/trap/i),
    }));
    expect(animationIds(disarmResult)).toContain(TRAP_DISARM_ANIMATION_ID);
    expect(combatLogText(disarmResult)).toMatch(/disarmed/i);
  });
}

test('rejected trap actions do not play success animations or consume turns', async ({ page }) => {
  await setRendererMode(page, 'canvas');
  const scenario = await ScenarioPage.load(page, TRAP_SCENARIO, 'desktop-default');
  const woodenTrapEntityId = trapItemEntityIdFromSerializedState(
    scenario.session.serializedState,
    'wooden_spike_trap',
  );

  const initialTrap = playerOriginTrapFromSerializedState(scenario.session.serializedState);
  expect(initialTrap).toEqual(expect.objectContaining({
    origin: 'player',
    isExhausted: false,
  }));

  const invalidInventoryResult = await postCommand(page, scenario, {
    type: 'SET_TRAP',
    direction: 'S',
    itemEntityId: 'missing_trap_item',
  });
  expect(eventOfType(invalidInventoryResult, 'PLAYER_ACTION_REJECTED')).toEqual(expect.objectContaining({
    actionType: 'SET_TRAP',
    reasonCode: 'TRAP_ITEM_NOT_IN_INVENTORY',
  }));
  expect(animationIds(invalidInventoryResult)).not.toContain(TRAP_PLACEMENT_ANIMATION_ID);
  expect(playerOriginTrapFromSerializedState(invalidInventoryResult.serializedState)).toEqual(initialTrap);

  const invalidDisarmResult = await postCommand(page, scenario, {
    type: 'DISARM_TRAP',
    direction: 'W',
  });
  expect(eventOfType(invalidDisarmResult, 'PLAYER_ACTION_REJECTED')).toEqual(expect.objectContaining({
    actionType: 'DISARM_TRAP',
    reasonCode: 'NO_TRAP_TARGET',
  }));
  expect(animationIds(invalidDisarmResult)).not.toContain(TRAP_DISARM_ANIMATION_ID);
  expect(playerOriginTrapFromSerializedState(invalidDisarmResult.serializedState)).toEqual(initialTrap);

  const occupiedTileResult = await postCommand(page, scenario, {
    type: 'SET_TRAP',
    direction: 'E',
    itemEntityId: woodenTrapEntityId,
  });
  expect(eventOfType(occupiedTileResult, 'PLAYER_ACTION_REJECTED')).toEqual(expect.objectContaining({
    actionType: 'SET_TRAP',
    reasonCode: 'TILE_OCCUPIED',
  }));
  expect(animationIds(occupiedTileResult)).not.toContain(TRAP_PLACEMENT_ANIMATION_ID);
  expect(playerOriginTrapFromSerializedState(occupiedTileResult.serializedState)).toEqual(initialTrap);
});
