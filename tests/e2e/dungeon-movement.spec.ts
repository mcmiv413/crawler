import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { CELL_SIZE } from '../../apps/web/src/config/ui-config.js';

interface DungeonMapSnapshot {
  readonly playerPosition: { readonly x: number; readonly y: number };
  readonly cells: readonly {
    readonly x: number;
    readonly y: number;
    readonly visibility: string;
    readonly walkable: boolean;
  }[];
  readonly entities: readonly {
    readonly id?: string;
    readonly x: number;
    readonly y: number;
    readonly type: string;
  }[];
}

interface ClickTarget {
  readonly target: { readonly x: number; readonly y: number };
  readonly path: readonly { readonly x: number; readonly y: number }[];
}

interface MovementProbe {
  readonly moveRequests: readonly {
    readonly at: number;
    readonly body: string;
  }[];
  readonly moveResponses: readonly {
    readonly at: number;
    readonly events: readonly {
      readonly type?: string;
      readonly enemyId?: string;
      readonly attackerId?: string;
    }[];
    readonly animatedEvents: readonly AnimatedEventLike[];
  }[];
  readonly moveAnimations: readonly {
    readonly at: number;
    readonly durationMs: number;
    readonly fromPos: { readonly x: number; readonly y: number };
    readonly toPos: { readonly x: number; readonly y: number };
  }[];
}

interface AnimatedEventLike {
  readonly type: string;
  readonly delayMs: number;
  readonly data: {
    readonly durationMs?: number;
  };
}

function getAnimatedEventBatchSettleUpperBoundMs(events: readonly AnimatedEventLike[]): number {
  if (events.length === 0) return 0;

  return Math.max(...events.map((event) => {
    const durationMs = typeof event.data?.durationMs === 'number' ? event.data.durationMs : 0;
    return event.delayMs + durationMs;
  }));
}

async function startDungeonRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.locator('button:has-text("New Game"), button:has-text("Start New Game")').first().click();
  await page.locator('button:has-text("Enter Dungeon")').first().click();
  await expect(page.locator('h2:has-text("Dungeon")')).toBeVisible();
}

async function startSeededDungeonRun(page: Page, seed: number): Promise<DungeonMapSnapshot> {
  const seededSession = await page.request.post('http://127.0.0.1:3000/api/games', {
    data: { seed, playerName: 'Playwright AutoWalk' },
  });
  expect(seededSession.ok()).toBe(true);
  const created = await seededSession.json();

  let dungeonMap: DungeonMapSnapshot | null = null;
  page.on('response', async (response) => {
    if (response.request().method() !== 'POST') {
      return;
    }

    if (/\/api\/games\/[^/]+\/commands$/.test(response.url()) === false) {
      return;
    }

    const body = response.request().postData() ?? '';
    if (body.includes('"type":"TOWN_ACTION"') === false || body.includes('"action":"enter_dungeon"') === false) {
      return;
    }

    const json = await response.json().catch(() => null) as { readonly view?: { readonly map?: DungeonMapSnapshot } } | null;
    dungeonMap = json?.view?.map ?? null;
  });

  await page.addInitScript((sessionData: {
    readonly gameId: string;
    readonly serializedState: string;
    readonly sessionToken: string;
  }) => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.sessionStorage.setItem('dungeon-session', JSON.stringify(sessionData));
    (window as Window & { __movementProbe?: MovementProbe }).__movementProbe = {
      moveRequests: [],
      moveResponses: [],
      moveAnimations: [],
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const [input, init] = args;
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      const body = typeof init?.body === 'string' ? init.body : undefined;

      if (/\/api\/games\/[^/]+\/commands$/.test(url) && body?.includes('"type":"MOVE"')) {
        const probe = (window as Window & { __movementProbe: MovementProbe }).__movementProbe;
        probe.moveRequests.push({ at: performance.now(), body });
      }

      const response = await originalFetch(...args);
      if (/\/api\/games\/[^/]+\/commands$/.test(url) && body?.includes('"type":"MOVE"')) {
        const probe = (window as Window & { __movementProbe: MovementProbe }).__movementProbe;
        const responseAt = performance.now();
        void response.clone().json().then((json: {
          readonly events?: readonly {
            readonly type?: string;
            readonly enemyId?: string;
            readonly attackerId?: string;
          }[];
          readonly view?: { readonly animatedEvents?: readonly AnimatedEventLike[] };
        }) => {
          probe.moveResponses.push({
            at: responseAt,
            events: json.events ?? [],
            animatedEvents: json.view?.animatedEvents ?? [],
          });
        }).catch(() => {
          probe.moveResponses.push({
            at: responseAt,
            events: [],
            animatedEvents: [],
          });
        });
      }

      return response;
    };

    window.addEventListener('move-animation', ((event: Event) => {
      const detail = (event as CustomEvent<{
        readonly durationMs: number;
        readonly fromPos: { readonly x: number; readonly y: number };
        readonly toPos: { readonly x: number; readonly y: number };
      }>).detail;
      const probe = (window as Window & { __movementProbe: MovementProbe }).__movementProbe;
      probe.moveAnimations.push({
        at: performance.now(),
        durationMs: detail.durationMs,
        fromPos: detail.fromPos,
        toPos: detail.toPos,
      });
    }) as EventListener);
  }, {
    gameId: created.gameId,
    serializedState: created.serializedState,
    sessionToken: created.sessionToken,
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Enter Dungeon")').first().click();
  await expect(page.locator('h2:has-text("Dungeon")')).toBeVisible();
  await expect.poll(() => dungeonMap !== null).toBe(true);
  return dungeonMap!;
}

function isMoveCommand(request: Request): boolean {
  if (request.method() !== 'POST') {
    return false;
  }

  if (/\/api\/games\/[^/]+\/commands$/.test(request.url()) === false) {
    return false;
  }

  return request.postData()?.includes('"type":"MOVE"') ?? false;
}

test('movement keeps accepting turn inputs while move animations settle', async ({ page }) => {
  const movePayloads: string[] = [];
  page.on('request', (request) => {
    if (isMoveCommand(request)) {
      movePayloads.push(request.postData() ?? '');
    }
  });

  await startDungeonRun(page);

  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(220);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(220);
  await page.keyboard.press('ArrowDown');

  await expect.poll(() => movePayloads.length).toBe(3);
  expect(movePayloads).toEqual([
    '{"type":"MOVE","direction":"N"}',
    '{"type":"MOVE","direction":"E"}',
    '{"type":"MOVE","direction":"S"}',
  ]);
});

function findPath(
  map: DungeonMapSnapshot,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number }[] {
  if (from.x === to.x && from.y === to.y) {
    return [];
  }

  const walkable = new Set<string>();
  for (const cell of map.cells) {
    if (cell.visibility !== 'hidden' && cell.walkable) {
      walkable.add(`${cell.x},${cell.y}`);
    }
  }

  const blocked = new Set<string>();
  for (const entity of map.entities) {
    if (entity.type === 'enemy') {
      blocked.add(`${entity.x},${entity.y}`);
    }
  }

  const startKey = `${from.x},${from.y}`;
  const goalKey = `${to.x},${to.y}`;
  if (walkable.has(goalKey) === false) {
    return [];
  }

  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();
  const queue = [from];
  const neighbors = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 1, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.x},${current.y}`;
    if (currentKey === goalKey) {
      const path: { x: number; y: number }[] = [];
      let key = goalKey;
      while (key !== startKey) {
        const [x, y] = key.split(',').map(Number);
        path.unshift({ x: x!, y: y! });
        key = parent.get(key)!;
      }
      return path;
    }

    for (const { dx, dy } of neighbors) {
      const next = { x: current.x + dx, y: current.y + dy };
      const nextKey = `${next.x},${next.y}`;
      if (visited.has(nextKey)) {
        continue;
      }
      if (walkable.has(nextKey) === false) {
        continue;
      }
      if (blocked.has(nextKey) && nextKey !== goalKey) {
        continue;
      }

      visited.add(nextKey);
      parent.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  return [];
}

function pickClickTarget(map: DungeonMapSnapshot): ClickTarget | null {
  const candidates = map.cells
    .filter((cell) =>
      cell.visibility === 'visible'
      && cell.walkable
      && (cell.x !== map.playerPosition.x || cell.y !== map.playerPosition.y))
    .map((cell) => ({
      target: { x: cell.x, y: cell.y },
      path: findPath(map, map.playerPosition, { x: cell.x, y: cell.y }),
    }))
    .filter((candidate) => candidate.path.length === 2)
    .sort((a, b) => {
      if (a.target.y !== b.target.y) {
        return a.target.y - b.target.y;
      }
      return a.target.x - b.target.x;
    });

  return candidates[0] ?? null;
}

function positionToDirection(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): string | null {
  return {
    '0,-1': 'N',
    '0,1': 'S',
    '1,0': 'E',
    '-1,0': 'W',
    '1,-1': 'NE',
    '-1,-1': 'NW',
    '1,1': 'SE',
    '-1,1': 'SW',
  }[`${to.x - from.x},${to.y - from.y}`] ?? null;
}

test('click auto-walk collapses hidden turns and waits only for visible animation settle', async ({ page }) => {
  const dungeonMap = await startSeededDungeonRun(page, 1);
  const target = pickClickTarget(dungeonMap);
  expect(target).not.toBeNull();

  const canvas = page.locator('canvas').nth(1);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const vpWidth = Math.round(box!.width / CELL_SIZE);
  const vpHeight = Math.round(box!.height / CELL_SIZE);
  const minX = Math.min(...dungeonMap.cells.map((cell) => cell.x));
  const minY = Math.min(...dungeonMap.cells.map((cell) => cell.y));
  const vpLeft = Math.max(minX, dungeonMap.playerPosition.x - Math.floor(vpWidth / 2));
  const vpTop = Math.max(minY, dungeonMap.playerPosition.y - Math.floor(vpHeight / 2));

  await canvas.click({
    position: {
      x: ((target!.target.x - vpLeft) * CELL_SIZE) + (CELL_SIZE / 2),
      y: ((target!.target.y - vpTop) * CELL_SIZE) + (CELL_SIZE / 2),
    },
  });

  await expect.poll(
    async () => page.evaluate(() => (window as Window & { __movementProbe: MovementProbe }).__movementProbe.moveRequests.length),
    { timeout: 5000 },
  ).toBe(2);
  await expect.poll(
    async () => page.evaluate(() => (window as Window & { __movementProbe: MovementProbe }).__movementProbe.moveResponses.length >= 1),
    { timeout: 5000 },
  ).toBe(true);

  const probe = await page.evaluate(
    () => (window as Window & { __movementProbe: MovementProbe }).__movementProbe,
  );
  const expectedDirections = [
    positionToDirection(dungeonMap.playerPosition, target!.path[0]!),
    positionToDirection(target!.path[0]!, target!.path[1]!),
  ];

  expect(probe.moveRequests.map((request) => request.body)).toEqual([
    `{\"type\":\"MOVE\",\"direction\":\"${expectedDirections[0]}\"}`,
    `{\"type\":\"MOVE\",\"direction\":\"${expectedDirections[1]}\"}`,
  ]);

  const firstMoveAnimation = probe.moveAnimations[0];
  const firstMoveResponse = probe.moveResponses[0];
  expect(firstMoveAnimation).toBeDefined();
  expect(firstMoveResponse).toBeDefined();
  expect(probe.moveRequests[1]!.at - firstMoveAnimation!.at).toBeGreaterThanOrEqual(firstMoveAnimation!.durationMs);
  const hiddenEnemyTurns = firstMoveResponse!.events.filter((event) =>
    event.enemyId !== undefined || (event.attackerId !== undefined && event.attackerId !== 'player-1'),
  );
  expect(hiddenEnemyTurns.length).toBeGreaterThan(0);
  const visibleSettleMs = getAnimatedEventBatchSettleUpperBoundMs(firstMoveResponse!.animatedEvents);
  expect(probe.moveRequests[1]!.at - firstMoveResponse!.at).toBeLessThanOrEqual(visibleSettleMs + 250);
});
