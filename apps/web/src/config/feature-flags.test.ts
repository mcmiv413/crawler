import { describe, it, expect, vi, afterEach } from 'vitest';
import { isThreeEffectsEnabledFlag } from './feature-flags.js';

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
