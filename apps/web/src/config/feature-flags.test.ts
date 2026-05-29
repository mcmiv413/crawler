import { describe, it, expect, vi, afterEach } from 'vitest';
import { isThreeEffectsEnabledFlag, getAnimationRendererMode } from './feature-flags.js';

describe('isThreeEffectsEnabledFlag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('default behaviour (no env var, no override)', () => {
    it('returns false when VITE_THREE_EFFECTS is not set', () => {
      // Ensure the key is absent rather than truthy
      vi.stubEnv('VITE_THREE_EFFECTS', '');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });
  });

  describe('env var control', () => {
    it('returns true when VITE_THREE_EFFECTS is "true"', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'true');
      expect(isThreeEffectsEnabledFlag()).toBe(true);
    });

    it('returns false when VITE_THREE_EFFECTS is "false"', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'false');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });

    it('returns false when VITE_THREE_EFFECTS is an unrecognised value', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'yes');
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });
  });

  describe('globalThis override', () => {
    it('returns true when override is true, regardless of env var', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'false');
      vi.stubGlobal('__DUNGEON_THREE_EFFECTS_OVERRIDE__', true);
      expect(isThreeEffectsEnabledFlag()).toBe(true);
    });

    it('returns false when override is false, regardless of env var', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'true');
      vi.stubGlobal('__DUNGEON_THREE_EFFECTS_OVERRIDE__', false);
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });

    it('override takes precedence over env var when both are set to conflicting values', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'true');
      vi.stubGlobal('__DUNGEON_THREE_EFFECTS_OVERRIDE__', false);
      expect(isThreeEffectsEnabledFlag()).toBe(false);
    });

    it('falls through to env var when override is undefined', () => {
      vi.stubEnv('VITE_THREE_EFFECTS', 'true');
      vi.stubGlobal('__DUNGEON_THREE_EFFECTS_OVERRIDE__', undefined);
      expect(isThreeEffectsEnabledFlag()).toBe(true);
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

    it('returns "canvas" when VITE_ANIMATION_RENDERER_MODE is an unrecognised value', () => {
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
