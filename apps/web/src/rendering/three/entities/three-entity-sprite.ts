/**
 * Tile-sized sprite plane for rendering entities in the Three.js overlay.
 *
 * Creates a PlaneGeometry of exactly tileSize × tileSize pixels so the sprite
 * covers one full tile in screen space. The mesh position uses the standard
 * overlay y-flip: Three y = canvasHeight - screenY.
 *
 * Movement and bump offsets are applied on top of the base screen position so
 * the entity appears to glide between tiles while the canvas renders the
 * static tile beneath.
 *
 * GPU resources (geometry + material) must be disposed when the entity
 * animation ends. Call disposeEntitySprite() in the module's dispose() method.
 */

import * as THREE from 'three';
import type { EntityView } from '@dungeon/presenter';
import type { ThreeEffectContext } from '../three-effect-types.js';
import { spriteRegistry } from '../../../sprites/sprite-registry.js';

export interface EntitySprite {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

function createEntityTexture(
  entity: Pick<EntityView, 'ascii' | 'color' | 'instanceColor' | 'spriteName' | 'type'>,
  tileSize: number,
): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  if (typeof canvas.getContext !== 'function') {
    return null;
  }
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return null;
  }

  let sprite = null;
  if (entity.spriteName !== undefined) {
    sprite = spriteRegistry.getSpriteByAtlasName(entity.spriteName);
  } else if (entity.type === 'player') {
    sprite = spriteRegistry.getSprite('player');
  }

  if (sprite !== null) {
    const { image, rect } = sprite;
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, tileSize, tileSize);
  } else {
    ctx.fillStyle = entity.color;
    ctx.font = `${Math.max(tileSize - 2, 1)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.ascii, tileSize / 2, tileSize / 2);
  }

  drawEntityInstanceColorMarker(ctx, tileSize, entity.instanceColor);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function drawEntityInstanceColorMarker(
  ctx: Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'>,
  tileSize: number,
  instanceColor?: string,
): void {
  if (instanceColor === undefined) {
    return;
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
  ctx.fillRect(tileSize - 5, 0, 5, 6);
  ctx.fillStyle = instanceColor;
  ctx.fillRect(tileSize - 4, 1, 3, 4);
}

/**
 * Create a tile-sized plane and add it to the scene.
 *
 * The plane's pixel size equals tileSize so it covers exactly one tile.
 * No texture is applied by default — callers can set material.map after
 * creation to apply a sprite sheet frame.
 */
export function createEntitySprite(context: ThreeEffectContext): EntitySprite {
  const geometry = new THREE.PlaneGeometry(context.tileSize, context.tileSize);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  context.scene.add(mesh);

  return { mesh, geometry, material };
}

export function applyEntitySpriteAppearance(
  sprite: EntitySprite,
  entity: Pick<EntityView, 'ascii' | 'color' | 'instanceColor' | 'spriteName' | 'type'>,
  tileSize: number,
): void {
  sprite.material.map?.dispose();
  sprite.material.map = createEntityTexture(entity, tileSize);
  sprite.material.color.set(sprite.material.map === null ? entity.color : '#ffffff');
  sprite.material.needsUpdate = true;
}

/**
 * Place the sprite at a screen-space pixel position.
 *
 * Applies the y-axis flip: Three y+ = up, game y+ = down.
 * mesh.position.y = canvasHeight - screenY
 */
export function setEntitySpritePosition(
  sprite: EntitySprite,
  position: { readonly x: number; readonly y: number; readonly z: number },
  canvasHeight: number,
): void {
  sprite.mesh.position.set(position.x, canvasHeight - position.y, position.z);
}

export function setEntitySpriteScale(
  sprite: EntitySprite,
  scale: { readonly x: number; readonly y: number },
): void {
  sprite.mesh.scale.set(scale.x, scale.y, 1);
}

/**
 * Apply a movement or bump offset on top of the base screen position.
 *
 * offsetX / offsetY are screen-space pixel deltas.
 * The y-flip is applied to (base.y + offsetY).
 */
export function setEntitySpriteMovementOffset(
  sprite: EntitySprite,
  base: { readonly x: number; readonly y: number; readonly z: number },
  offset: { readonly x: number; readonly y: number },
  canvasHeight: number,
): void {
  sprite.mesh.position.set(
    base.x + offset.x,
    canvasHeight - (base.y + offset.y),
    base.z,
  );
}

/**
 * Remove the sprite from the scene and release GPU resources.
 */
export function disposeEntitySprite(
  sprite: EntitySprite,
  scene: ThreeEffectContext['scene'],
): void {
  scene.remove(sprite.mesh);
  sprite.geometry.dispose();
  sprite.material.map?.dispose();
  sprite.material.dispose();
}
