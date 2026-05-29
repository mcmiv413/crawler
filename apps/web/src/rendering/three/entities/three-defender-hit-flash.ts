import * as THREE from 'three';
import type { ThreeEffectContext } from '../three-effect-types.js';

export interface DefenderHitFlash {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.PlaneGeometry;
  readonly material: THREE.MeshBasicMaterial;
}

export function createDefenderHitFlash(context: ThreeEffectContext): DefenderHitFlash {
  const geometry = new THREE.PlaneGeometry(context.tileSize * 1.1, context.tileSize * 1.1);
  const material = new THREE.MeshBasicMaterial({
    color: '#ff6666',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  context.scene.add(mesh);

  return { mesh, geometry, material };
}

export function setDefenderHitFlashPosition(
  flash: DefenderHitFlash,
  position: { readonly x: number; readonly y: number; readonly z: number },
  canvasHeight: number,
): void {
  flash.mesh.position.set(position.x, canvasHeight - position.y, position.z);
}

export function updateDefenderHitFlash(
  flash: DefenderHitFlash,
  progress: number,
): void {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const pulse = Math.sin(clampedProgress * Math.PI);
  flash.material.opacity = Math.max(0, 0.55 * (1 - clampedProgress));
  flash.mesh.scale.set(1 + pulse * 0.2, 1 + pulse * 0.2, 1);
}

export function disposeDefenderHitFlash(
  flash: DefenderHitFlash,
  scene: ThreeEffectContext['scene'],
): void {
  scene.remove(flash.mesh);
  flash.geometry.dispose();
  flash.material.dispose();
}
