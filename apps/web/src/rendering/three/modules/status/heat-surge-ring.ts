import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.RingGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
}

export const heatSurgeRing: ThreeAnimationModule<Instance> = {
  id: animationRefs.status.heatSurgeRing.id,
  category: animationRefs.status.heatSurgeRing.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.RingGeometry(tileSize * 0.32, tileSize * 0.54, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6020,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    ctx.scene.add(mesh);
    return { mesh, geometry, material, scene: ctx.scene };
  },

  setPosition(instance: Instance, pos: ThreeAnimationPosition): void {
    instance.mesh.position.set(pos.x, pos.y, pos.z);
  },

  update(instance: Instance, progress: number): void {
    const pulse = 0.75 + Math.sin(progress * Math.PI * 2) * 0.2;
    instance.material.opacity = 0.55 + Math.sin(progress * Math.PI * 2) * 0.25;
    instance.mesh.scale.setScalar(pulse);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
