/**
 * Factory for creating a Three.js WebGLRenderer configured for the 2D
 * tile-space overlay.  Returns null on WebGL failure so callers can
 * degrade gracefully instead of crashing.
 */

import * as THREE from 'three';

/**
 * The surface the component interacts with.  Flat so it matches the shape
 * the test mock returns — the renderer methods are top-level.
 */
export interface ThreeRendererHandle {
  setSize(width: number, height: number): void;
  render(scene: unknown, camera: unknown): void;
  dispose(): void;
  domElement: HTMLCanvasElement;
  /** Internal scene — used when driving effect modules */
  readonly scene: THREE.Scene;
  /** Internal camera */
  readonly camera: THREE.OrthographicCamera;
}

/**
 * Create a transparent, non-antialiased WebGLRenderer plus an
 * OrthographicCamera and Scene suitable for the 2D effects overlay.
 *
 * Returns null when WebGL is not available so the component can render
 * nothing rather than throwing.
 */
export function createThreeRenderer(canvas: HTMLCanvasElement): ThreeRendererHandle | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
    });
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    // Orthographic camera: left, right, top, bottom, near, far
    // We'll use screen-space coordinates (0,0) at top-left, extending to canvas dims.
    // The camera will be set up with actual dimensions in ThreeEffectsOverlay.
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 100);
    camera.position.z = 10;

    return {
      setSize: renderer.setSize.bind(renderer),
      render: renderer.render.bind(renderer),
      dispose: renderer.dispose.bind(renderer),
      domElement: renderer.domElement,
      scene,
      camera,
    };
  } catch {
    return null;
  }
}
