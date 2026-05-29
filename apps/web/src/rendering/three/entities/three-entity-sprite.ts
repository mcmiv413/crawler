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
import type { ThreeEffectContext } from '../three-effect-types.js';

export interface EntitySprite {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
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
  sprite.material.dispose();
}
