/**
 * Test layer: unit
 * Behavior: Feature Flags covers isDepthAtmosphereEnabledFlag; default behaviour (no env var, no override); returns true when VITE_DEPTH_ATMOSPHERE is not set.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/config/feature-flags.test.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isDepthAtmosphereEnabledFlag,
  isThreeEffectsEnabledFlag,
  getAnimationRendererMode,
} from './feature-flags.js';

type FeatureFlagEnvValue = string | boolean | undefined;

function withDepthAtmosphereEnv(value: FeatureFlagEnvValue, run: () => void): void {
  const env = import.meta.env as Record<string, FeatureFlagEnvValue>;
  const previous = env['VITE_DEPTH_ATMOSPHERE'];

  if (value === undefined) {
    Reflect.deleteProperty(env, 'VITE_DEPTH_ATMOSPHERE');
  } else {
    env['VITE_DEPTH_ATMOSPHERE'] = value;
  }

  try {
    run();
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(env, 'VITE_DEPTH_ATMOSPHERE');
    } else {
      env['VITE_DEPTH_ATMOSPHERE'] = previous;
    }
  }
}

describe('isDepthAtmosphereEnabledFlag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('default behaviour (no env var, no override)', () => {
    it('returns true when VITE_DEPTH_ATMOSPHERE is not set', () => {
      withDepthAtmosphereEnv(undefined, () => {
        expect(isDepthAtmosphereEnabledFlag()).toBe(true);
      });
    });

    it('returns true when VITE_DEPTH_ATMOSPHERE is empty', () => {
      withDepthAtmosphereEnv('', () => {
        expect(isDepthAtmosphereEnabledFlag()).toBe(true);
      });
    });
  });

  describe('env var control', () => {
    it('returns true when VITE_DEPTH_ATMOSPHERE is true', () => {
      withDepthAtmosphereEnv(true, () => {
        expect(isDepthAtmosphereEnabledFlag()).toBe(true);
      });
    });

    it('returns true when VITE_DEPTH_ATMOSPHERE is "true"', () => {
      withDepthAtmosphereEnv('true', () => {
        expect(isDepthAtmosphereEnabledFlag()).toBe(true);
      });
    });

    it('returns false when VITE_DEPTH_ATMOSPHERE is false', () => {
      withDepthAtmosphereEnv(false, () => {
        expect(isDepthAtmosphereEnabledFlag()).toBe(false);
      });
    });

    it('returns false when VITE_DEPTH_ATMOSPHERE is "false"', () => {
      withDepthAtmosphereEnv('false', () => {
        expect(isDepthAtmosphereEnabledFlag()).toBe(false);
      });
    });
  });

  describe('globalThis override', () => {
    it('override takes precedence over env var when both are set to conflicting values', () => {
      withDepthAtmosphereEnv('true', () => {
        vi.stubGlobal('__DUNGEON_DEPTH_ATMOSPHERE_OVERRIDE__', false);
        expect(isDepthAtmosphereEnabledFlag()).toBe(false);
      });
    });

    it('falls through to env var when override is undefined', () => {
      withDepthAtmosphereEnv('true', () => {
        vi.stubGlobal('__DUNGEON_DEPTH_ATMOSPHERE_OVERRIDE__', undefined);
        expect(isDepthAtmosphereEnabledFlag()).toBe(true);
      });
    });
  });
});

describe('isThreeEffectsEnabledFlag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('default behaviour (no env var, no override)', () => {
    it('returns false when VITE_ANIMATION_RENDERER_MODE is not set', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', '');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });
  });

  describe('env var control', () => {
    it('returns true when VITE_ANIMATION_RENDERER_MODE is "three"', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      expect(isThreeEffectsEnabledFlag()).toBe(true);
    });

    it('returns false when VITE_ANIMATION_RENDERER_MODE is "canvas"', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'canvas');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });

    it('returns false when VITE_ANIMATION_RENDERER_MODE is an unrecognised value', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'webgpu');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });
  });

  describe('renderer-mode alignment', () => {
    it('returns true when the renderer-mode override is "three"', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'canvas');
      vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', 'three');
      expect(isThreeEffectsEnabledFlag()).toBe(true);
    });

    it('returns false when the renderer-mode override is "canvas"', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', 'canvas');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });

    it('matches getAnimationRendererMode for the same inputs', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      expect(isThreeEffectsEnabledFlag()).toBe(true);
      expect(isThreeEffectsEnabledFlag()).toBe(getAnimationRendererMode() === 'three');
    });
  });
});

describe('getAnimationRendererMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('default behaviour (no env var, no override)', () => {
    it('returns "canvas" when VITE_ANIMATION_RENDERER_MODE is not set', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', '');
      expect(getAnimationRendererMode()).toBe('canvas');
    });
  });

  describe('env var control', () => {
    it('returns "canvas" when VITE_ANIMATION_RENDERER_MODE is "canvas"', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'canvas');
      expect(getAnimationRendererMode()).toBe('canvas');
    });

    it('returns "three" when VITE_ANIMATION_RENDERER_MODE is "three"', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      expect(getAnimationRendererMode()).toBe('three');
    });

    it('returns "canvas" when VITE_ANIMATION_RENDERER_MODE is an unrecognised value (falls through to default)', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'webgpu');
      expect(getAnimationRendererMode()).toBe('canvas');
    });
  });

  describe('globalThis override', () => {
    it('returns "three" when override is "three", regardless of env var', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'canvas');
      vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', 'three');
      expect(getAnimationRendererMode()).toBe('three');
    });

    it('returns "canvas" when override is "canvas", regardless of env var', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', 'canvas');
      expect(getAnimationRendererMode()).toBe('canvas');
    });

    it('override takes precedence over env var when both are set to conflicting values', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', 'canvas');
      expect(getAnimationRendererMode()).toBe('canvas');
    });

    it('falls through to env var when override is undefined', () => {
      vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
      vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', undefined);
      expect(getAnimationRendererMode()).toBe('three');
    });
  });
});
