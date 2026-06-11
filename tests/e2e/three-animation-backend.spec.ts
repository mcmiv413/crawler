import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CELL_SIZE } from '../../apps/web/src/config/ui-config.js';

const API_BASE = process.env['E2E_API_BASE'] ?? 'http://127.0.0.1:3000/api';
const APP_BASE = process.env['E2E_APP_BASE'] ?? '/';
const SEEDED_PLAYER_NAME = 'Playwright Three Animation Backend';
const SEEDED_RUN = 424242;
const DUMMY_ENEMY_ID = 'e2e-dummy-enemy';
const E2E_MOVE_DURATION_MS = 1_200;
const E2E_BUMP_DURATION_MS = 1_200;
const E2E_ABILITY_DURATION_MS = 1_200;
const E2E_CONSUMABLE_DURATION_MS = 1_200;
const E2E_DEFENDER_HIT_DURATION_MS = 1_000;

interface EntitySnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly ascii: string;
  readonly color: string;
  readonly name: string;
  readonly type: 'player' | 'enemy' | 'item' | 'object';
  readonly health?: number;
  readonly maxHealth?: number;
  readonly templateId: string | null;
  readonly spriteName?: string;
  readonly instanceColor?: string;
}

interface DungeonCellSnapshot {
  readonly x: number;
  readonly y: number;
  readonly walkable: boolean;
}

interface DungeonMapSnapshot {
  readonly playerPosition: { readonly x: number; readonly y: number };
  readonly cells: readonly DungeonCellSnapshot[];
  readonly entities: readonly EntitySnapshot[];
}

interface CreateGameSnapshot {
  readonly gameId: string;
  readonly serializedState: string;
  readonly sessionToken: string;
}

interface CommandSnapshot {
  readonly serializedState: string;
  readonly view: {
    readonly map: DungeonMapSnapshot | null;
  };
}

interface StoredSession {
  readonly gameId: string;
  readonly serializedState: string;
  readonly sessionToken: string;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ViewportSnapshot {
  readonly left: number;
  readonly top: number;
  readonly widthInTiles: number;
  readonly heightInTiles: number;
}

interface DungeonHarness {
  readonly session: StoredSession;
  readonly map: DungeonMapSnapshot;
  readonly playerTile: Point;
  readonly targetTile: Point;
  readonly clickTile: Point;
  readonly controlTile: Point;
}

interface RegionSnapshot {
  readonly width: number;
  readonly height: number;
  readonly data: readonly number[];
}

interface WebGlProofRegion {
  readonly center: Point;
  readonly halfSizePx: number;
  readonly minimumVisiblePixels: number;
}

interface WebGlControlRegion {
  readonly center: Point;
  readonly halfSizePx: number;
  readonly maximumVisiblePixels: number;
}

async function waitForDungeonE2EReady(page: Page): Promise<void> {
  await expect.poll(
    async () =>
      await page.evaluate(() => {
        const hook = (window as Window & {
          __DUNGEON_E2E__?: {
            ready?: boolean;
            api?: unknown;
          };
        }).__DUNGEON_E2E__;
        return hook?.ready === true && hook.api !== undefined;
      }),
    { timeout: 5_000 },
  ).toBe(true);
}

async function postCommand(
  page: Page,
  session: StoredSession,
  command: Record<string, unknown>,
): Promise<CommandSnapshot> {
  const response = await page.request.post(`${API_BASE}/games/${session.gameId}/commands`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Dungeon-Session': session.sessionToken,
    },
    data: command,
  });

  expect(response.ok()).toBe(true);
  return await response.json() as CommandSnapshot;
}

async function seedDungeonRun(page: Page): Promise<{
  readonly session: StoredSession;
  readonly map: DungeonMapSnapshot;
}> {
  const createdResponse = await page.request.post(`${API_BASE}/games`, {
    data: { seed: SEEDED_RUN, playerName: SEEDED_PLAYER_NAME },
  });
  expect(createdResponse.ok()).toBe(true);
  const created = await createdResponse.json() as CreateGameSnapshot;

  const session: StoredSession = {
    gameId: created.gameId,
    serializedState: created.serializedState,
    sessionToken: created.sessionToken,
  };

  const enteredDungeon = await postCommand(page, session, {
    type: 'TOWN_ACTION',
    action: 'enter_dungeon',
  });
  expect(enteredDungeon.view.map).not.toBeNull();

  return {
    session: {
      ...session,
      serializedState: enteredDungeon.serializedState,
    },
    map: enteredDungeon.view.map!,
  };
}

function findAdjacentOpenTiles(map: DungeonMapSnapshot): Point[] {
  const occupied = new Set(
    map.entities
      .filter((entity) => entity.type !== 'player')
      .map((entity) => `${entity.x},${entity.y}`),
  );
  const candidates = [
    { x: map.playerPosition.x + 1, y: map.playerPosition.y },
    { x: map.playerPosition.x - 1, y: map.playerPosition.y },
    { x: map.playerPosition.x, y: map.playerPosition.y + 1 },
    { x: map.playerPosition.x, y: map.playerPosition.y - 1 },
    { x: map.playerPosition.x + 1, y: map.playerPosition.y + 1 },
    { x: map.playerPosition.x - 1, y: map.playerPosition.y + 1 },
    { x: map.playerPosition.x + 1, y: map.playerPosition.y - 1 },
    { x: map.playerPosition.x - 1, y: map.playerPosition.y - 1 },
  ];

  return candidates.filter((candidate) =>
    map.cells.some((cell) => cell.x === candidate.x && cell.y === candidate.y && cell.walkable)
    && !occupied.has(`${candidate.x},${candidate.y}`),
  );
}

function findWalkableClickTile(map: DungeonMapSnapshot, blockedTiles: readonly Point[]): Point | undefined {
  const blocked = new Set(blockedTiles.map((tile) => `${tile.x},${tile.y}`));
  const occupied = new Set(
    map.entities
      .filter((entity) => entity.type !== 'player')
      .map((entity) => `${entity.x},${entity.y}`),
  );

  return map.cells
    .filter((cell) => cell.walkable)
    .map((cell) => ({ x: cell.x, y: cell.y }))
    .filter((cell) => !blocked.has(`${cell.x},${cell.y}`) && !occupied.has(`${cell.x},${cell.y}`))
    .sort((left, right) => {
      const leftDistance = Math.abs(left.x - map.playerPosition.x) + Math.abs(left.y - map.playerPosition.y);
      const rightDistance = Math.abs(right.x - map.playerPosition.x) + Math.abs(right.y - map.playerPosition.y);
      return leftDistance - rightDistance;
     })[0];
}

function minimumTileDistance(tile: Point, anchors: readonly Point[]): number {
  return Math.min(...anchors.map((anchor) => Math.abs(tile.x - anchor.x) + Math.abs(tile.y - anchor.y)));
}

function isTileVisible(tile: Point, viewport: ViewportSnapshot): boolean {
  return tile.x >= viewport.left
    && tile.x < viewport.left + viewport.widthInTiles
    && tile.y >= viewport.top
    && tile.y < viewport.top + viewport.heightInTiles;
}

function findWalkableControlTile(
  map: DungeonMapSnapshot,
  blockedTiles: readonly Point[],
  viewport?: ViewportSnapshot,
): Point | undefined {
  const blocked = new Set(blockedTiles.map((tile) => `${tile.x},${tile.y}`));
  const occupied = new Set(
    map.entities
      .filter((entity) => entity.type !== 'player')
      .map((entity) => `${entity.x},${entity.y}`),
  );

  return map.cells
    .filter((cell) => cell.walkable)
    .map((cell) => ({ x: cell.x, y: cell.y }))
    .filter((cell) =>
      !blocked.has(`${cell.x},${cell.y}`)
      && !occupied.has(`${cell.x},${cell.y}`)
      && (viewport === undefined || isTileVisible(cell, viewport)),
    )
    .sort((left, right) => {
      const leftDistance = minimumTileDistance(left, blockedTiles);
      const rightDistance = minimumTileDistance(right, blockedTiles);
      if (rightDistance !== leftDistance) {
        return rightDistance - leftDistance;
      }

      const leftPlayerDistance = Math.abs(left.x - map.playerPosition.x) + Math.abs(left.y - map.playerPosition.y);
      const rightPlayerDistance = Math.abs(right.x - map.playerPosition.x) + Math.abs(right.y - map.playerPosition.y);
      return rightPlayerDistance - leftPlayerDistance;
    })[0];
}

function computeViewportOrigin(
  map: DungeonMapSnapshot,
  vpTilesWidth: number,
  vpTilesHeight: number,
): { left: number; top: number } {
  const xs = map.cells.map((cell) => cell.x);
  const ys = map.cells.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    left: Math.max(minX, map.playerPosition.x - Math.floor(vpTilesWidth / 2)),
    top: Math.max(minY, map.playerPosition.y - Math.floor(vpTilesHeight / 2)),
  };
}

function tileCenterCssPx(
  tile: Point,
  viewportOrigin: { readonly left: number; readonly top: number },
): { x: number; y: number } {
  return {
    x: (tile.x - viewportOrigin.left + 0.5) * CELL_SIZE,
    y: (tile.y - viewportOrigin.top + 0.5) * CELL_SIZE,
  };
}

function midpointCssPx(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function offsetCssPx(point: Point, dx: number, dy: number): Point {
  return {
    x: point.x + dx,
    y: point.y + dy,
  };
}

async function getViewportOriginForHarness(
  page: Page,
  harness: DungeonHarness,
): Promise<{ left: number; top: number }> {
  const viewport = await getViewportSnapshot(page, harness.map);
  return {
    left: viewport.left,
    top: viewport.top,
  };
}

async function getViewportSnapshot(page: Page, map: DungeonMapSnapshot): Promise<ViewportSnapshot> {
  const dungeonCanvas = page.getByTestId('dungeon-canvas');
  const dungeonBox = await dungeonCanvas.boundingBox();
  expect(dungeonBox).not.toBeNull();

  const widthInTiles = Math.round(dungeonBox!.width / CELL_SIZE);
  const heightInTiles = Math.round(dungeonBox!.height / CELL_SIZE);
  const { left, top } = computeViewportOrigin(
    map,
    widthInTiles,
    heightInTiles,
  );

  return {
    left,
    top,
    widthInTiles,
    heightInTiles,
  };
}

function buildDummyEnemy(map: DungeonMapSnapshot, targetTile: Point): EntitySnapshot {
  const template = map.entities.find((entity) => entity.type === 'enemy');

  return {
    id: DUMMY_ENEMY_ID,
    x: targetTile.x,
    y: targetTile.y,
    ascii: template?.ascii ?? 'g',
    color: template?.color ?? '#ff6b6b',
    name: template?.name ?? 'Overlay Dummy',
    type: 'enemy',
    health: template?.health ?? 12,
    maxHealth: template?.maxHealth ?? 12,
    templateId: template?.templateId ?? 'rat',
    spriteName: template?.spriteName,
    instanceColor: '#ff00ff',
  };
}

async function openDungeon(
  page: Page,
  rendererMode: 'canvas' | 'three',
  options: { readonly forceWebGlFailure?: boolean } = {},
): Promise<DungeonHarness> {
  const { session, map } = await seedDungeonRun(page);
  const openTiles = findAdjacentOpenTiles(map);
  expect(openTiles.length, 'expected at least one open adjacent tile for deterministic E2E scenarios').toBeGreaterThanOrEqual(1);

  const [targetTile] = openTiles;
  const clickTile = findWalkableClickTile(map, [map.playerPosition, targetTile]);
  expect(clickTile, 'expected at least one walkable click tile for pointer-safety proof').toBeDefined();
  const dummyEnemy = buildDummyEnemy(map, targetTile);

  await page.addInitScript((payload: {
    readonly storedSession: StoredSession;
    readonly rendererMode: 'canvas' | 'three';
    readonly forceWebGlFailure: boolean;
  }) => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    (window as Window & {
      __DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__?: 'canvas' | 'three';
    }).__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__ = payload.rendererMode;
    (window as Window & {
      __DUNGEON_DEPTH_ATMOSPHERE_OVERRIDE__?: boolean;
    }).__DUNGEON_DEPTH_ATMOSPHERE_OVERRIDE__ = false;
    (window as Window & {
      __DUNGEON_E2E__?: { enabled?: boolean };
    }).__DUNGEON_E2E__ = { enabled: true };
    window.sessionStorage.setItem('dungeon-session', JSON.stringify(payload.storedSession));

    if (!payload.forceWebGlFailure) {
      return;
    }

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ): RenderingContext | null {
      if (contextId.toLowerCase().includes('webgl')) {
        return null;
      }

      return originalGetContext.call(this, contextId, ...args);
    };
  }, {
    storedSession: session,
    rendererMode,
    forceWebGlFailure: options.forceWebGlFailure ?? false,
  });

  await page.goto(APP_BASE, { waitUntil: 'networkidle' });
  await expect(page.locator('h2:has-text("Dungeon")')).toBeVisible();
  await waitForDungeonE2EReady(page);

  // WebGL control probes must stay inside the visible viewport; clamped
  // off-screen regions can sample the wrong canvas area and flake.
  const viewport = await getViewportSnapshot(page, map);
  const controlTile = findWalkableControlTile(
    map,
    [map.playerPosition, targetTile, clickTile!],
    viewport,
  );
  expect(controlTile, 'expected at least one visible walkable tile for WebGL control regions').toBeDefined();

  await page.evaluate(async (entity: EntitySnapshot) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          upsertMapEntity: (nextEntity: EntitySnapshot) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to be installed before injecting fixtures');
    }

    bridge.upsertMapEntity(entity);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }, dummyEnemy);

  return {
    session,
    map,
    playerTile: map.playerPosition,
    targetTile,
    clickTile: clickTile!,
    controlTile: controlTile!,
  };
}

async function emitMoveScenario(page: Page, harness: DungeonHarness): Promise<void> {
  await page.evaluate(({ fromPos, toPos, entityId, durationMs }) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          emitMoveAnimation: (animation: {
            entityId: string;
            fromPos: Point;
            toPos: Point;
            style: string;
            durationMs: number;
          }) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to emit move animations');
    }

    bridge.emitMoveAnimation({
      entityId,
      fromPos,
      toPos,
      style: 'step',
      durationMs,
    });
  }, {
    fromPos: harness.playerTile,
    toPos: harness.targetTile,
    entityId: DUMMY_ENEMY_ID,
    durationMs: E2E_MOVE_DURATION_MS,
  });
}

async function emitBumpScenario(page: Page, harness: DungeonHarness): Promise<void> {
  await page.evaluate(({ attackerPos, defenderPos, attackerId, defenderId, durationMs, impactFrameMs }) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          emitBumpAnimation: (animation: {
            attackerId: string;
            defenderId: string;
            attackerPos: Point;
            defenderPos: Point;
            durationMs: number;
            impactFrameMs: number;
          }) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to emit bump animations');
    }

    bridge.emitBumpAnimation({
      attackerId,
      defenderId,
      attackerPos,
      defenderPos,
      durationMs,
      impactFrameMs,
    });
  }, {
    attackerPos: harness.targetTile,
    defenderPos: harness.playerTile,
    attackerId: DUMMY_ENEMY_ID,
    defenderId: 'player',
    durationMs: E2E_BUMP_DURATION_MS,
    impactFrameMs: E2E_BUMP_DURATION_MS / 2,
  });
}

async function emitAbilityScenario(
  page: Page,
  harness: DungeonHarness,
  animationId: string,
  blastPositions: readonly Point[] = [],
): Promise<void> {
  await page.evaluate(({ playerPos, targetPos, animationId, blastPositions, durationMs, impactFrameMs }) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          emitAbilityAnimation: (animation: {
            abilityId: string;
            animationId: string;
            playerPos: Point;
            targetPos: Point;
            blastPositions: readonly Point[];
            durationMs: number;
            impactFrameMs: number;
            suppressActorBump: boolean;
          }) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to emit ability animations');
    }

    bridge.emitAbilityAnimation({
      abilityId: 'playwright-three-proof',
      animationId,
      playerPos,
      targetPos,
      blastPositions,
      durationMs,
      impactFrameMs,
      suppressActorBump: true,
    });
  }, {
    playerPos: harness.playerTile,
    targetPos: harness.targetTile,
    animationId,
    blastPositions,
    durationMs: E2E_ABILITY_DURATION_MS,
    impactFrameMs: E2E_ABILITY_DURATION_MS / 2,
  });
}

async function emitConsumableScenario(page: Page, harness: DungeonHarness): Promise<void> {
  await page.evaluate(({ playerPos, durationMs }) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          emitConsumableAnimation: (animation: {
            effect: string;
            animationId: string;
            playerPos: Point;
            blastPositions: readonly Point[];
            durationMs: number;
            presentation: {
              kind: string;
              durationMs: number;
            };
          }) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to emit consumable animations');
    }

    bridge.emitConsumableAnimation({
      effect: 'heal',
      animationId: 'fx.self.healing-pulse',
      playerPos,
      blastPositions: [],
      durationMs,
      presentation: {
        kind: 'heal_hearts',
        durationMs,
      },
    });
  }, {
    playerPos: harness.playerTile,
    durationMs: E2E_CONSUMABLE_DURATION_MS,
  });
}

async function emitStatusScenario(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          setPlayerStatuses: (statuses: readonly {
            id: string;
            name: string;
            turnsRemaining: number;
            beneficial: boolean;
            presentation?: {
              animationId?: string;
              entityScale?: number;
            };
          }[]) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to inject player statuses');
    }

    bridge.setPlayerStatuses([
      {
        id: 'e2e-strength',
        name: 'Strength',
        turnsRemaining: 3,
        beneficial: true,
        presentation: {
          animationId: 'fx.status.gold-ring-pulse',
          entityScale: 1.18,
        },
      },
    ]);
  });
}

async function emitCombatIndicatorScenario(page: Page, harness: DungeonHarness): Promise<void> {
  await page.evaluate(({ x, y }) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          emitCombatIndicator: (x: number, y: number, text: string, type?: 'damage' | 'heal' | 'status' | 'gold') => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to emit combat indicators');
    }

    bridge.emitCombatIndicator(x, y, '12', 'damage');
  }, harness.targetTile);
}

async function emitDefenderHitScenario(page: Page): Promise<void> {
  await page.evaluate(({ entityId, durationMs }) => {
    const bridge = (window as Window & {
      __DUNGEON_E2E__?: {
        api?: {
          triggerDefenderHit: (id: string, durationMs: number) => void;
        };
      };
    }).__DUNGEON_E2E__?.api;
    if (bridge === undefined) {
      throw new Error('Expected the Dungeon E2E bridge to trigger defender-hit flashes');
    }

    bridge.triggerDefenderHit(entityId, durationMs);
  }, { entityId: DUMMY_ENEMY_ID, durationMs: E2E_DEFENDER_HIT_DURATION_MS });
}

async function countVisibleWebGlPixels(page: Page, testId: string): Promise<number> {
  return await page.evaluate((targetTestId) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-testid="${targetTestId}"]`);
    if (!(canvas instanceof HTMLCanvasElement)) {
      return -1;
    }

    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl == null) {
      return -1;
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let visiblePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;

      if (alpha >= 12 && (red + green + blue) >= 24) {
        visiblePixels += 1;
      }
    }

    return visiblePixels;
  }, testId);
}

async function countVisibleWebGlRegionPixels(
  page: Page,
  testId: string,
  center: Point,
  halfSizePx: number,
): Promise<number> {
  return await page.evaluate(({ targetTestId, center, halfSizePx }) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-testid="${targetTestId}"]`);
    if (!(canvas instanceof HTMLCanvasElement)) {
      return -1;
    }

    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl == null) {
      return -1;
    }

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || canvas.clientWidth || canvas.width || gl.drawingBufferWidth;
    const cssHeight = rect.height || canvas.clientHeight || canvas.height || gl.drawingBufferHeight;
    if (cssWidth <= 0 || cssHeight <= 0) {
      return -1;
    }

    const scaleX = gl.drawingBufferWidth / cssWidth;
    const scaleY = gl.drawingBufferHeight / cssHeight;
    const scaledHalfWidth = Math.max(1, Math.floor(halfSizePx * scaleX));
    const scaledHalfHeight = Math.max(1, Math.floor(halfSizePx * scaleY));
    const scaledCenterX = center.x * scaleX;
    const scaledCenterY = center.y * scaleY;

    const left = Math.max(0, Math.floor(scaledCenterX - scaledHalfWidth));
    const right = Math.min(gl.drawingBufferWidth, Math.ceil(scaledCenterX + scaledHalfWidth));
    const top = Math.max(0, Math.floor(scaledCenterY - scaledHalfHeight));
    const bottom = Math.min(gl.drawingBufferHeight, Math.ceil(scaledCenterY + scaledHalfHeight));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const pixels = new Uint8Array(width * height * 4);

    gl.readPixels(left, gl.drawingBufferHeight - bottom, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let visiblePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;

      if (alpha >= 12 && (red + green + blue) >= 24) {
        visiblePixels += 1;
      }
    }

    return visiblePixels;
  }, {
    targetTestId: testId,
    center,
    halfSizePx,
  });
}

async function readCanvasRegion(
  page: Page,
  testId: string,
  center: { readonly x: number; readonly y: number },
  halfSizePx: number,
): Promise<RegionSnapshot> {
  return await page.evaluate(({ targetTestId, center, halfSizePx }) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-testid="${targetTestId}"]`);
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas "${targetTestId}" was not found`);
    }

    const context = canvas.getContext('2d');
    if (context == null) {
      throw new Error(`Canvas "${targetTestId}" does not expose a 2D context`);
    }

    const left = Math.max(0, Math.floor(center.x - halfSizePx));
    const top = Math.max(0, Math.floor(center.y - halfSizePx));
    const width = Math.max(1, Math.min(canvas.width - left, halfSizePx * 2));
    const height = Math.max(1, Math.min(canvas.height - top, halfSizePx * 2));
    const image = context.getImageData(left, top, width, height);

    return {
      width,
      height,
      data: Array.from(image.data),
    };
  }, {
    targetTestId: testId,
    center,
    halfSizePx,
  });
}

function countChangedPixels(before: RegionSnapshot, after: RegionSnapshot): number {
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(after.data.length).toBe(before.data.length);

  let changed = 0;
  for (let index = 0; index < before.data.length; index += 4) {
    const delta =
      Math.abs((before.data[index] ?? 0) - (after.data[index] ?? 0))
      + Math.abs((before.data[index + 1] ?? 0) - (after.data[index + 1] ?? 0))
      + Math.abs((before.data[index + 2] ?? 0) - (after.data[index + 2] ?? 0))
      + Math.abs((before.data[index + 3] ?? 0) - (after.data[index + 3] ?? 0));

    if (delta >= 24) {
      changed += 1;
    }
  }

  return changed;
}

async function waitForOverlayPixels(page: Page, minimumPixels: number): Promise<void> {
  await expect.poll(
    async () => countVisibleWebGlPixels(page, 'three-animation-overlay'),
    { timeout: 5_000 },
  ).toBeGreaterThan(minimumPixels);
}

async function waitForOverlayRegions(
  page: Page,
  expectedRegions: readonly WebGlProofRegion[],
  controlRegions: readonly WebGlControlRegion[],
): Promise<void> {
  let lastResult = {
    visibleExpected: [] as number[],
    visibleControls: [] as number[],
    maxVisibleExpected: [] as number[],
    maxVisibleControls: [] as number[],
  };

  try {
    await expect.poll(
      async () => {
        const visibleExpected = await Promise.all(
          expectedRegions.map((region) =>
            countVisibleWebGlRegionPixels(page, 'three-animation-overlay', region.center, region.halfSizePx)),
        );
        const visibleControls = await Promise.all(
          controlRegions.map((region) =>
            countVisibleWebGlRegionPixels(page, 'three-animation-overlay', region.center, region.halfSizePx)),
        );

        lastResult = {
          visibleExpected,
          visibleControls,
          maxVisibleExpected: visibleExpected.map((count, index) =>
            Math.max(count, lastResult.maxVisibleExpected[index] ?? -1)),
          maxVisibleControls: visibleControls.map((count, index) =>
            Math.max(count, lastResult.maxVisibleControls[index] ?? -1)),
        };

        return visibleExpected.every((count, index) => count >= expectedRegions[index]!.minimumVisiblePixels)
          && visibleControls.every((count, index) => count <= controlRegions[index]!.maximumVisiblePixels);
      },
      { timeout: 5_000 },
    ).toBe(true);
  } catch (error) {
    const suffix = `Last overlay region counts: ${JSON.stringify(lastResult)}`;
    if (error instanceof Error) {
      throw new Error(`${error.message}\n${suffix}`);
    }

    throw new Error(`${String(error)}\n${suffix}`);
  }
}

const WEBGL_CATEGORY_SCENARIOS: ReadonlyArray<{
  readonly name: string;
  readonly run: (page: Page, harness: DungeonHarness) => Promise<void>;
  readonly expectedRegions: (
    harness: DungeonHarness,
    viewportOrigin: { readonly left: number; readonly top: number },
  ) => readonly WebGlProofRegion[];
  readonly controlRegions: (
    harness: DungeonHarness,
    viewportOrigin: { readonly left: number; readonly top: number },
  ) => readonly WebGlControlRegion[];
}> = [
  {
    name: 'movement',
    run: emitMoveScenario,
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: midpointCssPx(
          tileCenterCssPx(harness.playerTile, viewportOrigin),
          tileCenterCssPx(harness.targetTile, viewportOrigin),
        ),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 80,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'bump attack',
    run: emitBumpScenario,
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: midpointCssPx(
          tileCenterCssPx(harness.playerTile, viewportOrigin),
          tileCenterCssPx(harness.targetTile, viewportOrigin),
        ),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 50,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'projectile',
    run: (page, harness) => emitAbilityScenario(page, harness, 'fx.projectile.arrow-volley', [harness.targetTile]),
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: midpointCssPx(
          tileCenterCssPx(harness.playerTile, viewportOrigin),
          tileCenterCssPx(harness.targetTile, viewportOrigin),
        ),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 24,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'impact',
    run: (page, harness) => emitAbilityScenario(page, harness, 'fx.impact.forward-slash'),
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.targetTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 20,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'aoe',
    run: (page, harness) => emitAbilityScenario(page, harness, 'fx.aoe.bomb-blast', [harness.targetTile]),
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.targetTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 24,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'self consumable',
    run: emitConsumableScenario,
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.playerTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 24,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'status pulse',
    run: async (page) => {
      await emitStatusScenario(page);
    },
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.playerTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 24,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'combat label',
    run: emitCombatIndicatorScenario,
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: offsetCssPx(tileCenterCssPx(harness.targetTile, viewportOrigin), 0, -CELL_SIZE * 0.75),
        halfSizePx: CELL_SIZE * 2,
        minimumVisiblePixels: 32,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
  {
    name: 'defender-hit flash',
    run: async (page) => {
      await emitDefenderHitScenario(page);
    },
    expectedRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.targetTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        minimumVisiblePixels: 20,
      },
    ],
    controlRegions: (harness, viewportOrigin) => [
      {
        center: tileCenterCssPx(harness.controlTile, viewportOrigin),
        halfSizePx: CELL_SIZE,
        maximumVisiblePixels: 8,
      },
    ],
  },
];

for (const scenario of WEBGL_CATEGORY_SCENARIOS) {
  test(`Three animation backend renders ${scenario.name} through WebGL`, async ({ page }) => {
    const harness = await openDungeon(page, 'three');
    const viewportOrigin = await getViewportOriginForHarness(page, harness);
    await scenario.run(page, harness);
    await waitForOverlayRegions(
      page,
      scenario.expectedRegions(harness, viewportOrigin),
      scenario.controlRegions(harness, viewportOrigin),
    );
  });
}

test('Three animation overlay stays click-through over the dungeon canvas', async ({ page }) => {
  const harness = await openDungeon(page, 'three');
  await emitConsumableScenario(page, harness);
  await waitForOverlayPixels(page, 18);

  const overlay = page.getByTestId('three-animation-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCSS('pointer-events', 'none');

  const dungeonCanvas = page.getByTestId('dungeon-canvas');
  await expect(dungeonCanvas).toBeVisible();
  const dungeonBox = await dungeonCanvas.boundingBox();
  expect(dungeonBox).not.toBeNull();

  const viewportOrigin = computeViewportOrigin(
    harness.map,
    Math.round(dungeonBox!.width / CELL_SIZE),
    Math.round(dungeonBox!.height / CELL_SIZE),
  );
  const clickTarget = tileCenterCssPx(harness.clickTile, viewportOrigin);

  const moveRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
      && /\/api\/games\/[^/]+\/commands$/.test(request.url())
      && (request.postData()?.includes('"type":"MOVE"') ?? false),
  );

  await page.mouse.click(dungeonBox!.x + clickTarget.x, dungeonBox!.y + clickTarget.y);

  const request = await moveRequest;
  expect(request.postData()).toContain('"type":"MOVE"');
});

test('forced WebGL failure falls back to the dungeon canvas and canvas cannot satisfy the WebGL assertion', async ({ page }) => {
  const harness = await openDungeon(page, 'three', { forceWebGlFailure: true });
  const dungeonCanvas = page.getByTestId('dungeon-canvas');
  await expect(dungeonCanvas).toBeVisible();

  const dungeonBox = await dungeonCanvas.boundingBox();
  expect(dungeonBox).not.toBeNull();

  const viewportOrigin = computeViewportOrigin(
    harness.map,
    Math.round(dungeonBox!.width / CELL_SIZE),
    Math.round(dungeonBox!.height / CELL_SIZE),
  );
  const playerCenter = tileCenterCssPx(harness.playerTile, viewportOrigin);

  const before = await readCanvasRegion(page, 'dungeon-canvas', playerCenter, CELL_SIZE);
  await emitConsumableScenario(page, harness);

  await expect.poll(
    async () => {
      const after = await readCanvasRegion(page, 'dungeon-canvas', playerCenter, CELL_SIZE);
      return countChangedPixels(before, after);
    },
    { timeout: 5_000 },
  ).toBeGreaterThan(20);

  await expect(page.getByTestId('three-animation-overlay')).toHaveCount(0);
  expect(await countVisibleWebGlPixels(page, 'dungeon-canvas')).toBe(-1);
});
