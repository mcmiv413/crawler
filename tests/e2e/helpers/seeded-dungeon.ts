import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const API_BASE = 'http://127.0.0.1:3000';

export interface SeedCommandResult {
  readonly serializedState: string;
  readonly view?: {
    readonly map?: {
      readonly playerPosition: { readonly x: number; readonly y: number };
      readonly entities: readonly {
        readonly type: string;
        readonly x: number;
        readonly y: number;
        readonly health?: number;
        readonly maxHealth?: number;
      }[];
    } | null;
  };
}

export function findNearestViableEnemy(
  view: SeedCommandResult['view'],
): { readonly x: number; readonly y: number; readonly distance: number } | undefined {
  const map = view?.map;
  if (map === undefined || map === null) {
    return undefined;
  }

  const player = map.playerPosition;
  let nearest: { x: number; y: number; distance: number } | undefined;
  for (const entity of map.entities) {
    if (entity.type !== 'enemy') {
      continue;
    }
    const durability = entity.maxHealth ?? entity.health ?? 0;
    if (durability < 20) {
      continue;
    }
    const distance = Math.max(Math.abs(entity.x - player.x), Math.abs(entity.y - player.y));
    if (nearest === undefined || distance < nearest.distance) {
      nearest = { x: entity.x, y: entity.y, distance };
    }
  }
  return nearest;
}

async function sendSeedCommand(
  page: Page,
  gameId: string,
  sessionToken: string,
  command: Record<string, unknown>,
): Promise<SeedCommandResult | undefined> {
  const response = await page.request.post(`${API_BASE}/api/games/${gameId}/commands`, {
    headers: { 'X-Dungeon-Session': sessionToken },
    data: command,
  });
  if (!response.ok()) {
    return undefined;
  }
  return await response.json() as SeedCommandResult;
}

async function stepTowardTarget(
  page: Page,
  gameId: string,
  sessionToken: string,
  current: SeedCommandResult,
  target: { readonly x: number; readonly y: number },
): Promise<SeedCommandResult | undefined> {
  const player = current.view?.map?.playerPosition;
  if (player === undefined) {
    return undefined;
  }
  const vertical = target.y < player.y ? 'N' : target.y > player.y ? 'S' : '';
  const horizontal = target.x > player.x ? 'E' : target.x < player.x ? 'W' : '';
  const directions = [`${vertical}${horizontal}`, 'N', 'E', 'S', 'W'].filter((direction) => direction !== '');

  for (const direction of directions) {
    const next = await sendSeedCommand(page, gameId, sessionToken, { type: 'MOVE', direction });
    if (next === undefined) {
      continue;
    }
    const nextPlayer = next.view?.map?.playerPosition;
    if (nextPlayer !== undefined && (nextPlayer.x !== player.x || nextPlayer.y !== player.y)) {
      return next;
    }
  }
  return undefined;
}

/**
 * Seeds a game via the API and walks the player adjacent to an enemy with
 * enough durability to survive a hit, then loads that session in the browser.
 * Enemies never spawn within attack range, so the walk is required to make
 * attack-driven tests deterministic.
 */
export async function seedAttackReadyDungeon(page: Page, playerName: string): Promise<void> {
  for (let seed = 1; seed <= 60; seed += 1) {
    const createdResponse = await page.request.post(`${API_BASE}/api/games`, {
      data: { seed, playerName },
    });
    expect(createdResponse.ok()).toBe(true);
    const created = await createdResponse.json() as {
      readonly gameId: string;
      readonly serializedState: string;
      readonly sessionToken: string;
    };

    let current = await sendSeedCommand(page, created.gameId, created.sessionToken, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
    });

    for (let step = 0; step < 25 && current !== undefined; step += 1) {
      const target = findNearestViableEnemy(current.view);
      if (target === undefined) {
        break;
      }
      if (target.distance <= 1) {
        await page.evaluate((sessionData) => {
          window.sessionStorage.clear();
          window.localStorage.clear();
          window.sessionStorage.setItem('dungeon-session', JSON.stringify(sessionData));
        }, {
          gameId: created.gameId,
          serializedState: current.serializedState,
          sessionToken: created.sessionToken,
        });
        await page.goto('/', { waitUntil: 'networkidle' });
        await expect(page.locator('[data-testid="dungeon-view"]')).toBeVisible({ timeout: 5000 });
        return;
      }
      current = await stepTowardTarget(page, created.gameId, created.sessionToken, current, target);
    }
  }

  throw new Error('Could not seed a dungeon with the player adjacent to an attackable enemy');
}
