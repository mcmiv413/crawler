import type { MapView, MapCellView, EntityView } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';
import { spriteRegistry } from './sprite-registry.js';

/** Draw a single tile sprite or ASCII fallback onto the canvas. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  cell: MapCellView,
  screenX: number,
  screenY: number,
): void {
  const isRemembered = cell.visibility === 'remembered';

  if (isRemembered) {
    ctx.globalAlpha = 0.35;
  }

  // Try to use atlas sprite name first, then fall back to old getTileSprite
  let sprite = null;
  if (cell.spriteName) {
    sprite = spriteRegistry.getSpriteByAtlasName(cell.spriteName);
  }

  if (sprite) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, screenX, screenY, CELL_SIZE, CELL_SIZE);
  } else {
    // ASCII fallback
    ctx.fillStyle = cell.bgColor;
    ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
    ctx.fillStyle = cell.color;
    ctx.font = `${CELL_SIZE - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cell.ascii, screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2);
  }

  if (isRemembered) {
    ctx.globalAlpha = 1.0;
  }
}

/** Draw an entity sprite or ASCII fallback. */
function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: EntityView,
  screenX: number,
  screenY: number,
): void {
  // Use entity's atlas name if available (enemies, items, objects)
  let sprite = null;
  if ('spriteName' in entity && entity.spriteName) {
    sprite = spriteRegistry.getSpriteByAtlasName(entity.spriteName);
  } else if (entity.type === 'player') {
    // Fallback to player sprite
    sprite = spriteRegistry.getSprite('player');
  }

  if (sprite) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, screenX, screenY, CELL_SIZE, CELL_SIZE);
  } else {
    // ASCII fallback
    ctx.fillStyle = entity.color;
    ctx.font = `${CELL_SIZE - 2}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.ascii, screenX + CELL_SIZE / 2, screenY + CELL_SIZE / 2);
  }
}

/** Render the dungeon map onto the given canvas context. */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: MapView,
  vpLeft: number,
  vpTop: number,
  vpWidth: number,
  vpHeight: number,
): void {
  // Clear canvas
  ctx.clearRect(0, 0, vpWidth * CELL_SIZE, vpHeight * CELL_SIZE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, vpWidth * CELL_SIZE, vpHeight * CELL_SIZE);

  // Build fast lookup maps
  const cellLookup = new Map<string, MapCellView>();
  for (const cell of map.cells) {
    cellLookup.set(`${cell.x},${cell.y}`, cell);
  }

  const entityLookup = new Map<string, EntityView>();
  for (const entity of map.entities) {
    entityLookup.set(`${entity.x},${entity.y}`, entity);
  }

  // Draw cells then entities
  for (let gy = vpTop; gy < vpTop + vpHeight; gy++) {
    for (let gx = vpLeft; gx < vpLeft + vpWidth; gx++) {
      const screenX = (gx - vpLeft) * CELL_SIZE;
      const screenY = (gy - vpTop) * CELL_SIZE;
      const key = `${gx},${gy}`;
      const cell = cellLookup.get(key);

      if (!cell) continue;

      drawCell(ctx, cell, screenX, screenY);

      // Draw entity on top (only for visible cells)
      if (cell.visibility === 'visible') {
        const entity = entityLookup.get(key);
        if (entity) {
          drawEntity(ctx, entity, screenX, screenY);

          // Draw gold border for nemesis enemies
          if (entity.isNemesis) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX + 1, screenY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          }
        }
      }
    }
  }
}
