import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { healingPulseEffect } from './healing-pulse-effect.js';
import type { ThreeEffectContext } from '../three-effect-types.js';

describe('healing-pulse-effect', () => {
  let mockContext: ThreeEffectContext;
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      add: vi.fn(),
      remove: vi.fn(),
    };

    mockContext = {
      renderer: {} as any,
      scene: mockScene,
      camera: {} as any,
      canvasWidth: 512,
      canvasHeight: 448,
      vpLeft: 0,
      vpTop: 0,
      tileSize: 16, // Standard tile size
    };
  });

  it('creates a geometry and mesh', () => {
    const instance = healingPulseEffect.create(mockContext);

    expect(instance).toBeDefined();
    expect(instance.group).toBeInstanceOf(THREE.Group);
    expect(instance.mesh).toBeInstanceOf(THREE.Mesh);
    expect(instance.geometry).toBeInstanceOf(THREE.CircleGeometry);
    expect(instance.material).toBeInstanceOf(THREE.MeshBasicMaterial);
  });

  it('adds the group to the scene', () => {
    healingPulseEffect.create(mockContext);

    expect(mockScene.add).toHaveBeenCalledWith(expect.any(THREE.Group));
  });

  it('scales the mesh to be visibly tile-sized in pixel space', () => {
    const instance = healingPulseEffect.create(mockContext);
    const maxMeshScale = 1.0;
    const groupScale = instance.group.scale.x;

    const maxRadiusPixels = instance.geometry.parameters.radius * maxMeshScale * groupScale;
    expect(maxRadiusPixels).toBeCloseTo(mockContext.tileSize * 0.45, 3);
    expect((maxRadiusPixels * 2) / mockContext.tileSize).toBeCloseTo(0.9, 2);
    expect(groupScale).toBe(mockContext.tileSize);
  });

  it('positions the effect group using overlay screen space with a Three scene Y flip', () => {
    const instance = healingPulseEffect.create(mockContext);

    healingPulseEffect.setPosition(instance, { x: 80, y: 96, z: 0 });

    expect(instance.group.position.x).toBe(80);
    expect(instance.group.position.y).toBe(mockContext.canvasHeight - 96);
    expect(instance.group.position.z).toBe(0);
  });

  it('updates opacity and scale during animation', () => {
    const instance = healingPulseEffect.create(mockContext);

    // At progress 0 (start of grow phase)
    healingPulseEffect.update(instance, 0);
    expect(instance.material.opacity).toBe(1);
    expect(instance.mesh.scale.x).toBeCloseTo(0.2);

    // At progress 0.25 (halfway through grow)
    healingPulseEffect.update(instance, 0.25);
    expect(instance.material.opacity).toBe(1);
    expect(instance.mesh.scale.x).toBeCloseTo(0.6); // 0.2 + 0.25/0.5 * 0.8

    // At progress 0.5 (end of grow, start of fade)
    healingPulseEffect.update(instance, 0.5);
    expect(instance.material.opacity).toBe(1);
    expect(instance.mesh.scale.x).toBeCloseTo(1.0);

    // At progress 0.75 (halfway through fade)
    healingPulseEffect.update(instance, 0.75);
    expect(instance.material.opacity).toBeCloseTo(0.5);
    expect(instance.mesh.scale.x).toBeCloseTo(1.0);

    // At progress 1 (end, fully faded)
    healingPulseEffect.update(instance, 1);
    expect(instance.material.opacity).toBe(0);
    expect(instance.mesh.scale.x).toBeCloseTo(1.0);
  });

  it('disposes resources on cleanup', () => {
    const instance = healingPulseEffect.create(mockContext);

    healingPulseEffect.dispose(instance);

    expect(mockScene.remove).toHaveBeenCalledWith(instance.group);
    // Geometry and material disposal don't throw, they just mark for cleanup
  });
});
