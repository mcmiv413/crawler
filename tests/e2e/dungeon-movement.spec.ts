/**
 * Test layer: e2e
 * Behavior: Dungeon movement accepts queued keyboard directions during animation, auto-walk waits only for visible settle timing across hidden enemy turns, and long canvas walks remain visually continuous.
 * Proof: Assertions check three MOVE request bodies for N/E/S, two auto-walk MOVE bodies matching path directions, request timing against STEP_WALK_BOUNDARY_PROGRESS and animated settle bounds, hidden enemy-turn events, and canvas visible-pixel and frame-delta thresholds.
 * Validation: pnpm test:e2e tests/e2e/dungeon-movement.spec.ts
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page, Request } from '@playwright/test';
import { CELL_SIZE } from '../../apps/web/src/config/ui-config.js';
import { STEP_WALK_BOUNDARY_PROGRESS } from '../../apps/web/src/animations/move-style-profiles.js';
import { E2E_API_BASE } from './support/api-base.js';
import { tryPostDataJSON } from './support/scenario-page.js';

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

interface MoveCommandBody {
  readonly type?: unknown;
  readonly direction?: unknown;
}

interface MovementProbe {
  readonly moveRequests: readonly {
    readonly at: number;
    readonly body: MoveCommandBody;
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
  const seededSession = await page.request.post(`${E2E_API_BASE}/games`, {
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

    const body = tryPostDataJSON(response.request()) as {
      readonly type?: unknown;
      readonly action?: unknown;
    } | null | undefined;
    if (body?.type !== 'TOWN_ACTION' || body.action !== 'enter_dungeon') {
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

    // Init scripts accumulate across startSeededDungeonRun calls; only the
    // first one may wire the fetch/animation probes or requests get counted
    // once per registered script.
    const wireGuard = window as Window & { __movementProbeWired?: boolean };
    if (wireGuard.__movementProbeWired === true) {
      return;
    }
    wireGuard.__movementProbeWired = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const [input, init] = args;
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      const rawBody = typeof init?.body === 'string' ? init.body : undefined;
      let body: MoveCommandBody | undefined;
      try {
        body = rawBody === undefined ? undefined : JSON.parse(rawBody) as MoveCommandBody;
      } catch {
        body = undefined;
      }

      if (/\/api\/games\/[^/]+\/commands$/.test(url) && body !== undefined && body.type === 'MOVE') {
        const probe = (window as Window & { __movementProbe: MovementProbe }).__movementProbe;
        probe.moveRequests.push({ at: performance.now(), body });
      }

      const response = await originalFetch(...args);
      if (/\/api\/games\/[^/]+\/commands$/.test(url) && body !== undefined && body.type === 'MOVE') {
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

  const body = tryPostDataJSON(request) as { readonly type?: unknown } | null | undefined;
  return body?.type === 'MOVE';
}

test('movement keeps accepting turn inputs while move animations settle', async ({ page }) => {
  const movePayloads: unknown[] = [];
  page.on('request', (request) => {
    if (isMoveCommand(request)) {
      movePayloads.push(tryPostDataJSON(request));
    }
  });

  await startDungeonRun(page);

  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(220); // audit-allow-waitForTimeout: animation timing assertion
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(220); // audit-allow-waitForTimeout: animation timing assertion
  await page.keyboard.press('ArrowDown');

  await expect.poll(() => movePayloads.length).toBe(3);
  expect(movePayloads).toEqual([
    { type: 'MOVE', direction: 'N' },
    { type: 'MOVE', direction: 'E' },
    { type: 'MOVE', direction: 'S' },
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

function pickLongClickTarget(map: DungeonMapSnapshot): ClickTarget | null {
  const candidates = map.cells
    .filter((cell) =>
      cell.visibility === 'visible'
      && cell.walkable
      && (cell.x !== map.playerPosition.x || cell.y !== map.playerPosition.y))
    .map((cell) => ({
      target: { x: cell.x, y: cell.y },
      path: findPath(map, map.playerPosition, { x: cell.x, y: cell.y }),
    }))
    .filter((candidate) => candidate.path.length >= 4)
    .sort((a, b) => {
      if (a.path.length !== b.path.length) {
        return a.path.length - b.path.length;
      }
      if (a.target.y !== b.target.y) {
        return a.target.y - b.target.y;
      }
      return a.target.x - b.target.x;
    });

  return candidates[0] ?? null;
}

interface CanvasFrameSample {
  readonly visiblePixels: number;
  readonly centerVisiblePixels: number;
  readonly sampledLuma: readonly number[];
}

async function sampleCanvasFrame(canvas: Locator): Promise<CanvasFrameSample> {
  return canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const ctx = canvasElement.getContext('2d');
    if (ctx === null) {
      return { visiblePixels: 0, centerVisiblePixels: 0, sampledLuma: [] };
    }

    const { width, height } = canvasElement;
    const image = ctx.getImageData(0, 0, width, height).data;
    let visiblePixels = 0;
    let centerVisiblePixels = 0;
    const sampledLuma: number[] = [];
    const centerLeft = Math.floor(width * 0.25);
    const centerRight = Math.ceil(width * 0.75);
    const centerTop = Math.floor(height * 0.25);
    const centerBottom = Math.ceil(height * 0.75);
    const sampleStride = Math.max(1, Math.floor((width * height) / 512));

    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const offset = pixel * 4;
      const luma = image[offset]! + image[offset + 1]! + image[offset + 2]!;
      if (luma > 12) {
        visiblePixels += 1;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        if (x >= centerLeft && x <= centerRight && y >= centerTop && y <= centerBottom) {
          centerVisiblePixels += 1;
        }
      }

      if (pixel % sampleStride === 0) {
        sampledLuma.push(Math.round(luma / 3));
      }
    }

    return { visiblePixels, centerVisiblePixels, sampledLuma };
  });
}

function averageFrameDelta(a: CanvasFrameSample, b: CanvasFrameSample): number {
  const count = Math.min(a.sampledLuma.length, b.sampledLuma.length);
  if (count === 0) return 0;

  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += Math.abs(a.sampledLuma[index]! - b.sampledLuma[index]!);
  }
  return total / count;
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

  const canvas = page.getByTestId('dungeon-canvas');
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
    { type: 'MOVE', direction: expectedDirections[0] },
    { type: 'MOVE', direction: expectedDirections[1] },
  ]);

  const firstMoveAnimation = probe.moveAnimations[0];
  const firstMoveResponse = probe.moveResponses[0];
  expect(firstMoveAnimation).toBeDefined();
  expect(firstMoveResponse).toBeDefined();
  expect(probe.moveRequests[1]!.at - firstMoveAnimation!.at).toBeGreaterThanOrEqual(
    firstMoveAnimation!.durationMs * STEP_WALK_BOUNDARY_PROGRESS,
  );
  const hiddenEnemyTurns = firstMoveResponse!.events.filter((event) =>
    event.enemyId !== undefined || (event.attackerId !== undefined && event.attackerId !== 'player-1'),
  );
  expect(hiddenEnemyTurns.length).toBeGreaterThan(0);
  const visibleSettleMs = getAnimatedEventBatchSettleUpperBoundMs(firstMoveResponse!.animatedEvents);
  expect(probe.moveRequests[1]!.at - firstMoveResponse!.at).toBeLessThanOrEqual(visibleSettleMs + 250);
});

test('four-tile click auto-walk renderer stays visually continuous on canvas', async ({ page }) => {
  // Auto-walk intentionally cancels when a newly revealed enemy interrupts the
  // route, so probe candidate seeds until one supports an uninterrupted walk.
  const candidateSeeds = [7, 1, 5, 9, 13, 17, 19, 25, 31, 34];

  for (const seed of candidateSeeds) {
    const dungeonMap = await startSeededDungeonRun(page, seed);
    const target = pickLongClickTarget(dungeonMap);
    if (target === null) {
      continue;
    }

    const canvas = page.getByTestId('dungeon-canvas');
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
        x: ((target.target.x - vpLeft) * CELL_SIZE) + (CELL_SIZE / 2),
        y: ((target.target.y - vpTop) * CELL_SIZE) + (CELL_SIZE / 2),
      },
    });

    const samples: CanvasFrameSample[] = [];
    let moveCount = 0;
    let lastCount = 0;
    let stagnantIterations = 0;
    for (let index = 0; index < 60; index += 1) {
      await page.waitForTimeout(50); // audit-allow-waitForTimeout: animation timing assertion
      samples.push(await sampleCanvasFrame(canvas));
      moveCount = await page.evaluate(
        () => (window as Window & { __movementProbe: MovementProbe }).__movementProbe.moveRequests.length,
      );
      if (moveCount === lastCount) {
        stagnantIterations += 1;
      } else {
        stagnantIterations = 0;
        lastCount = moveCount;
      }
      if (moveCount >= 4 || stagnantIterations >= 16) {
        break;
      }
    }

    if (moveCount < 4) {
      // The walk was interrupted by a revealed threat; try the next seed.
      continue;
    }

    for (let index = 0; index < 4; index += 1) {
      await page.waitForTimeout(50); // audit-allow-waitForTimeout: animation timing assertion
      samples.push(await sampleCanvasFrame(canvas));
    }

    // Early-run maps are smaller than the canvas viewport and render clamped
    // to the top-left, so the canvas center is legitimately dark; continuity
    // means no frame ever collapses toward blank.
    const maxVisible = Math.max(...samples.map((sample) => sample.visiblePixels));
    expect(maxVisible).toBeGreaterThan(0);
    for (const sample of samples) {
      expect(sample.visiblePixels).toBeGreaterThan(maxVisible * 0.5);
    }

    const deltas = samples.slice(1).map((sample, index) => averageFrameDelta(samples[index]!, sample));
    expect(Math.max(...deltas)).toBeLessThan(140);
    return;
  }

  throw new Error('No candidate seed produced an uninterrupted four-tile auto-walk');
});
