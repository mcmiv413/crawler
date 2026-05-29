/**
 * Type contracts for the Three.js effect overlay system.
 *
 * These are intentionally loose (any) placeholders so that the coordinate
 * utilities and effect registry can be implemented and tested without pulling
 * in the full Three.js type tree.  Concrete implementations swap in the real
 * Three types at the call-site.
 */

export interface ThreeEffectContext {
  /** WebGLRenderer instance (typed as any to avoid a hard Three.js import) */
  renderer: any;
  /** Three.Scene that effects are added to */
  scene: any;
  /** Three.OrthographicCamera used for the overlay */
  camera: any;
  /** Pixel width of the canvas/viewport */
  canvasWidth: number;
  /** Pixel height of the canvas/viewport */
  canvasHeight: number;
  /** Left edge of the visible viewport in tile coordinates */
  vpLeft: number;
  /** Top edge of the visible viewport in tile coordinates */
  vpTop: number;
  /** Size of one tile in pixels (for coordinate conversions) */
  tileSize: number;
}

export interface ThreeEffectModule {
  /** Create and return a new effect instance, attaching it to the scene */
  create(context: ThreeEffectContext): any;
  /**
   * Advance the effect.
   * @param effect   The instance returned by create()
   * @param progress Normalised progress in [0, 1]
   */
  update(effect: any, progress: number): void;
  /** Tear down the effect and release GPU resources */
  dispose(effect: any): void;
}
