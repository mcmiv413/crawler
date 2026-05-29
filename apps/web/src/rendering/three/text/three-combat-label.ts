/**
 * Disposable text texture for floating combat indicator labels.
 *
 * Renders a text string onto a canvas, uploads it as a Three.js texture,
 * and places it on a plane mesh in the overlay scene. Each label is an
 * independent instance so multiple labels can stack and fade independently.
 *
 * Lifecycle: create → setPosition → setCombatLabelOpacity (fade) → dispose.
 * The texture, material, and geometry must all be disposed to release GPU
 * memory. The texture is created per-label (not shared) so dispose() can
 * release it without affecting other instances.
 *
 * Y-axis convention
 * -----------------
 * setCombatLabelPosition applies the same overlay y-flip as other helpers:
 *   mesh.position.y = canvasHeight - screenY
 */

import * as THREE from 'three';
import type { ThreeEffectContext } from '../three-effect-types.js';

/** Dimensions for the offscreen canvas used to rasterize label text. */
const LABEL_CANVAS_WIDTH = 128;
const LABEL_CANVAS_HEIGHT = 32;
const LABEL_FONT = 'bold 16px sans-serif';
const LABEL_COLOR = '#ffffff';

export interface CombatLabel {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

/**
 * Create a combat label with the given text and add it to the scene.
 *
 * The text is rasterized onto an offscreen canvas, uploaded as a texture,
 * and applied to a small plane mesh. Initial opacity is 1.
 */
export function createCombatLabel(context: ThreeEffectContext, text: string): CombatLabel {
  const texture = buildLabelTexture(text);

  // Aspect ratio matches the canvas dimensions
  const aspectRatio = LABEL_CANVAS_WIDTH / LABEL_CANVAS_HEIGHT;
  const labelHeight = context.tileSize * 0.8;
  const labelWidth = labelHeight * aspectRatio;

  const geometry = new THREE.PlaneGeometry(labelWidth, labelHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
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
 * Set the opacity of the label (for fade-out animations).
 */
export function setCombatLabelOpacity(label: CombatLabel, opacity: number): void {
  label.material.opacity = opacity;
}

/**
 * Position the label in screen space, applying the y-axis flip.
 */
export function setCombatLabelPosition(
  label: CombatLabel,
  position: { readonly x: number; readonly y: number; readonly z: number },
  canvasHeight: number,
): void {
  label.mesh.position.set(position.x, canvasHeight - position.y, position.z);
}

/**
 * Remove the label from the scene and release GPU resources.
 * Must be called once the label animation ends.
 */
export function disposeCombatLabel(
  label: CombatLabel,
  scene: ThreeEffectContext['scene'],
): void {
  scene.remove(label.mesh);
  label.geometry.dispose();
  if (label.material.map) {
    label.material.map.dispose();
  }
  label.material.dispose();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildLabelTexture(text: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS_WIDTH;
  canvas.height = LABEL_CANVAS_HEIGHT;

  // getContext may return null in test environments (happy-dom, node-canvas not installed).
  // Guard gracefully so the label is created without 2D content.
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (ctx) {
    ctx.clearRect(0, 0, LABEL_CANVAS_WIDTH, LABEL_CANVAS_HEIGHT);
    ctx.font = LABEL_FONT;
    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, LABEL_CANVAS_WIDTH / 2, LABEL_CANVAS_HEIGHT / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
