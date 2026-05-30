import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { CELL_SIZE } from '../../apps/web/src/config/ui-config.js';

const API_BASE = process.env['E2E_API_BASE'] ?? 'http://127.0.0.1:3000/api';
const APP_BASE = process.env['E2E_APP_BASE'] ?? '/';
const SEEDED_PLAYER_NAME = 'Playwright Three Overlay';
const SEEDED_RUN = 424242;

interface InventoryItemSnapshot {
  readonly id: string;
}

interface DungeonCellSnapshot {
  readonly x: number;
  readonly y: number;
  readonly walkable: boolean;
}

interface DungeonMapSnapshot {
  readonly playerPosition: { readonly x: number; readonly y: number };
  readonly cells: readonly DungeonCellSnapshot[];
}

interface CreateGameSnapshot {
  readonly gameId: string;
  readonly serializedState: string;
  readonly sessionToken: string;
  readonly view: {
    readonly inventory: {
      readonly items: readonly InventoryItemSnapshot[];
    };
  };
}

interface CommandSnapshot {
  readonly serializedState: string;
  readonly view: {
    readonly map: DungeonMapSnapshot | null;
  };
}

interface StoredSession {
  gameId: string;
  serializedState: string;
  sessionToken: string;
}

function hasHealthPotion(items: readonly InventoryItemSnapshot[]): boolean {
  return items.some((item) => item.id === 'health_potion' || item.id === 'greater_health_potion');
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

async function seedDungeonRunWithPotion(page: Page): Promise<{
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

  if (!hasHealthPotion(created.view.inventory.items)) {
    const boughtPotion = await postCommand(page, session, {
      type: 'TOWN_ACTION',
      action: 'shop_buy',
      itemId: 'health_potion',
    });
    session.serializedState = boughtPotion.serializedState;
  }

  const enteredDungeon = await postCommand(page, session, {
    type: 'TOWN_ACTION',
    action: 'enter_dungeon',
  });
  session.serializedState = enteredDungeon.serializedState;

  expect(enteredDungeon.view.map).not.toBeNull();

  return {
    session,
    map: enteredDungeon.view.map!,
  };
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
  tile: { readonly x: number; readonly y: number },
  viewportOrigin: { readonly left: number; readonly top: number },
): { x: number; y: number } {
  return {
    x: (tile.x - viewportOrigin.left + 0.5) * CELL_SIZE,
    y: (tile.y - viewportOrigin.top + 0.5) * CELL_SIZE,
  };
}

function findAdjacentWalkableTile(map: DungeonMapSnapshot): { x: number; y: number } {
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

  const walkable = candidates.find((candidate) =>
    map.cells.some((cell) => cell.x === candidate.x && cell.y === candidate.y && cell.walkable),
  );

  expect(walkable, 'expected a walkable tile next to the seeded player start').toBeDefined();
  return walkable!;
}

async function countVisibleOverlayPixels(
  page: Page,
  overlayCanvasIndex: number,
): Promise<number> {
  return await page.evaluate((canvasIndex) => {
    const canvas = Array.from(document.querySelectorAll('canvas')).at(canvasIndex);
    if (!(canvas instanceof HTMLCanvasElement)) {
      return -1;
    }

    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl === null) {
      return -1;
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let visiblePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];

      if (alpha >= 16 && green > red + 8 && green > blue + 8) {
        visiblePixels += 1;
      }
    }

    return visiblePixels;
  }, overlayCanvasIndex);
}

async function findCanvasIndexByTestId(page: Page, testId: string): Promise<number> {
  return await page.evaluate((expectedTestId) => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    return canvases.findIndex((canvas) => canvas.getAttribute('data-testid') === expectedTestId);
  }, testId);
}

async function findPrimaryDungeonCanvasIndex(page: Page): Promise<number> {
  const taggedIndex = await findCanvasIndexByTestId(page, 'dungeon-canvas');
  if (taggedIndex >= 0) {
    return taggedIndex;
  }

  return await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    let bestIndex = -1;
    let bestArea = -1;

    canvases.forEach((canvas, index) => {
      const rect = canvas.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.width > 0 && rect.height > 0 && area > bestArea) {
        bestIndex = index;
        bestArea = area;
      }
    });

    return bestIndex;
  });
}

async function findOverlayCanvasIndex(
  page: Page,
  dungeonCanvasIndex: number,
  dungeonCanvasSize: { readonly width: number; readonly height: number },
): Promise<number> {
  const taggedIndex = await findCanvasIndexByTestId(page, 'three-animation-overlay');
  if (taggedIndex >= 0) {
    return taggedIndex;
  }

  return await page.evaluate(({ dungeonCanvasIndex, minArea }) => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const candidates = canvases
      .map((canvas, index) => ({ canvas, index, rect: canvas.getBoundingClientRect() }))
      .filter(({ index, rect }) =>
        index !== dungeonCanvasIndex
        && rect.width > 0
        && rect.height > 0
        && rect.width * rect.height >= minArea,
      );

    return candidates.at(-1)?.index ?? -1;
  }, {
    dungeonCanvasIndex,
    minArea: dungeonCanvasSize.width * dungeonCanvasSize.height * 0.9,
  });
}

test('Three healing pulse overlay stays aligned and click-through over the dungeon canvas', async ({ page }) => {
  const { session, map } = await seedDungeonRunWithPotion(page);

  await page.addInitScript((storedSession: StoredSession) => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    (window as Window & { __DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__?: string }).__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__ = 'three';
    window.sessionStorage.setItem('dungeon-session', JSON.stringify(storedSession));
  }, session);

  await page.goto(APP_BASE, { waitUntil: 'networkidle' });
  await expect(page.locator('h2:has-text("Dungeon")')).toBeVisible();

  const dungeonCanvasIndex = await findPrimaryDungeonCanvasIndex(page);
  expect(dungeonCanvasIndex, 'expected the dungeon view to render a primary canvas').toBeGreaterThanOrEqual(0);
  const dungeonCanvas = page.locator('canvas').nth(dungeonCanvasIndex);
  await expect(dungeonCanvas).toBeVisible();

  await page.getByRole('button', { name: /^Use\b/ }).click();
  await page.getByRole('button', { name: /Health Potion/i }).first().click();

  const dungeonBox = await dungeonCanvas.boundingBox();
  expect(dungeonBox).not.toBeNull();

  await expect.poll(
    async () => findOverlayCanvasIndex(page, dungeonCanvasIndex, {
      width: dungeonBox!.width,
      height: dungeonBox!.height,
    }),
    { timeout: 5_000 },
  ).toBeGreaterThanOrEqual(0);

  const overlayCanvasIndex = await findOverlayCanvasIndex(page, dungeonCanvasIndex, {
    width: dungeonBox!.width,
    height: dungeonBox!.height,
  });
  const overlay = page.locator('canvas').nth(overlayCanvasIndex);
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();

  expect(overlayBox).not.toBeNull();
  expect(overlayBox!.x).toBeCloseTo(dungeonBox!.x, 1);
  expect(overlayBox!.y).toBeCloseTo(dungeonBox!.y, 1);
  expect(overlayBox!.width).toBeCloseTo(dungeonBox!.width, 1);
  expect(overlayBox!.height).toBeCloseTo(dungeonBox!.height, 1);

  const vpTilesWidth = Math.round(dungeonBox!.width / CELL_SIZE);
  const vpTilesHeight = Math.round(dungeonBox!.height / CELL_SIZE);
  const viewportOrigin = computeViewportOrigin(map, vpTilesWidth, vpTilesHeight);
  await expect.poll(
    async () =>
      countVisibleOverlayPixels(
        page,
        overlayCanvasIndex,
      ),
    { timeout: 5_000 },
  ).toBeGreaterThan(25);

  const clickTarget = tileCenterCssPx(findAdjacentWalkableTile(map), viewportOrigin);
  const moveRequest = page.waitForRequest((request) =>
    request.method() === 'POST'
      && /\/api\/games\/[^/]+\/commands$/.test(request.url())
      && (request.postData()?.includes('"type":"MOVE"') ?? false),
  );

  await page.mouse.click(overlayBox!.x + clickTarget.x, overlayBox!.y + clickTarget.y);

  const request = await moveRequest;
  expect(request.postData()).toContain('"type":"MOVE"');
});
