/**
 * Shared mock Three.js renderer for component and module tests.
 *
 * Returns a renderer handle with vi.fn() stubs for all methods and a
 * scene/camera that records calls. No real WebGL context is created.
 *
 * Usage:
 *   const { renderer, scene, camera } = makeMockThreeRenderer();
 *   // pass renderer as createRenderer prop or ThreeEffectContext.renderer
 */

import { vi } from 'vitest';

export interface MockScene {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

export interface MockCamera {
  left: number;
  right: number;
  top: number;
  bottom: number;
  updateProjectionMatrix: ReturnType<typeof vi.fn>;
}

export interface MockRendererHandle {
  setSize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  domElement: HTMLCanvasElement | null;
  scene: MockScene;
  camera: MockCamera;
}

/**
 * Create a fresh mock renderer handle with independent vi.fn() instances.
 * Call this inside beforeEach() to ensure test isolation.
 */
export function makeMockThreeRenderer(): MockRendererHandle {
  return {
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: typeof document !== 'undefined' ? document.createElement('canvas') : null,
    scene: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    camera: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      updateProjectionMatrix: vi.fn(),
    },
  };
}

/**
 * Build a ThreeEffectContext from a mock renderer handle.
 * Useful for passing to module create() methods in tests.
 */
export function makeMockContext(
  handle: MockRendererHandle,
  overrides: Partial<{
    canvasWidth: number;
    canvasHeight: number;
    vpLeft: number;
    vpTop: number;
    tileSize: number;
  }> = {},
) {
  return {
    renderer: handle,
    scene: handle.scene,
    camera: handle.camera,
    canvasWidth: overrides.canvasWidth ?? 480,
    canvasHeight: overrides.canvasHeight ?? 360,
    vpLeft: overrides.vpLeft ?? 0,
    vpTop: overrides.vpTop ?? 0,
    tileSize: overrides.tileSize ?? 24,
  };
}
