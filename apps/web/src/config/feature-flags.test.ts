import { describe, it, expect, vi, afterEach } from 'vitest';
import { isThreeEffectsEnabledFlag, getAnimationRendererMode } from './feature-flags.js';

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
