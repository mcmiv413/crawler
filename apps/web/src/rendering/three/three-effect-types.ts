/**
 * Type contracts for the Three.js effect overlay system.
 *
 * These stay renderer-light so unit tests and registry code do not need to
 * import the full Three.js type tree, while still preserving one shared
 * contract for create/update/dispose and the overlay context shape.
 */

export interface ThreeEffectContext {
  /** WebGL renderer handle used by the overlay. */
  readonly renderer: unknown;
  /** Scene-like surface that effect instances attach to and detach from. */
  readonly scene: {
    add(object: unknown): void;
    remove(object: unknown): void;
  };
  /** Overlay camera surface. */
  readonly camera: unknown;
  /** Pixel width of the canvas/viewport */
  readonly canvasWidth: number;
  /** Pixel height of the canvas/viewport */
  readonly canvasHeight: number;
  /** Left edge of the visible viewport in tile coordinates */
  readonly vpLeft: number;
  /** Top edge of the visible viewport in tile coordinates */
  readonly vpTop: number;
  /** Size of one tile in pixels (for coordinate conversions) */
  readonly tileSize: number;
}

export interface ThreeEffectScreenPosition {
  /** Screen-space x position in overlay pixels */
  readonly x: number;
  /** Screen-space y position in overlay pixels */
  readonly y: number;
  /** Screen-space z position for layering within the Three scene */
  readonly z: number;
  /** Optional projectile/source origin in overlay pixels. */
  readonly source?: {
    readonly x: number;
    readonly y: number;
  };
  /** Optional projectile/destination target in overlay pixels. */
  readonly target?: {
    readonly x: number;
    readonly y: number;
  };
}

export interface ThreeEffectModule<TInstance = unknown> {
  /** Create and return a new effect instance, attaching it to the scene */
  create(context: ThreeEffectContext): TInstance;
  /** Move the effect instance to the requested overlay pixel position */
  setPosition(effect: TInstance, position: ThreeEffectScreenPosition): void;
  /**
   * Advance the effect.
   * @param effect   The instance returned by create()
   * @param progress Normalised progress in [0, 1]
   */
  update(effect: TInstance, progress: number): void;
  /** Tear down the effect and release GPU resources */
  dispose(effect: TInstance): void;
}
