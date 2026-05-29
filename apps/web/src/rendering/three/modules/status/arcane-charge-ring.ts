import * as THREE from 'three';
import { animationRefs } from '@dungeon/content';
import type { ThreeAnimationModule, ThreeAnimationContext, ThreeAnimationPosition } from '../../three-animation-types.js';

interface Instance {
  mesh: THREE.Mesh;
  geometry: THREE.RingGeometry;
  material: THREE.MeshBasicMaterial;
  scene: ThreeAnimationContext['scene'];
}

export const arcaneChargeRing: ThreeAnimationModule<Instance> = {
  id: animationRefs.status.arcaneChargeRing.id,
  category: animationRefs.status.arcaneChargeRing.category,

  create(ctx: ThreeAnimationContext): Instance {
    const { tileSize } = ctx;
    const geometry = new THREE.RingGeometry(tileSize * 0.3, tileSize * 0.52, 40);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4aa3ff,
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
    const pulse = 0.9 + Math.sin(progress * Math.PI * 2) * 0.12;
    instance.material.opacity = 0.42 + Math.sin(progress * Math.PI * 2) * 0.22;
    instance.mesh.rotation.z = progress * Math.PI * 0.35;
    instance.mesh.scale.setScalar(pulse);
  },

  dispose(instance: Instance): void {
    instance.scene.remove(instance.mesh);
    instance.geometry.dispose();
    instance.material.dispose();
  },
};
