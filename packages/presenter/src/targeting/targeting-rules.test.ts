/**
 * Test layer: unit
 * Behavior: Targeting rules derive effective ranges, valid enemy and trap targets, auto-target selection, and action enablement from ability modes and positions.
 * Proof: Expectations check exact range objects, adjacent enemy ids and trap counts, null versus single auto-target returns, boolean enablement for target modes, and occupied-position direction counts.
 * Validation: pnpm vitest run packages/presenter/src/targeting/targeting-rules.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  getEffectiveRange,
  getValidEnemyTargets,
  getAutoTargetOrShowChooser,
  isTargetingActionEnabled,
  getValidDisarmableTraps,
  getValidTrapPlacementDirections,
} from './targeting-rules.js';
import type { EntityView } from '../game-view.js';

describe('Targeting Rules', () => {
  describe('getEffectiveRange', () => {
    it('returns melee range (1) for non-ranged abilities', () => {
      const ability = { id: 'power_strike', isRanged: false };
      const range = getEffectiveRange(ability, null);
      expect(range).toEqual({ max: 1, min: 0 });
    });

    it('returns weapon range for ranged abilities with weapon', () => {
      const ability = { id: 'ranged_pin', isRanged: true };
      const mockWeapon = { weaponStats: { weaponRange: 5, minRange: 2 } };
      const range = getEffectiveRange(ability, mockWeapon);
      expect(range).toEqual({ max: 5, min: 2 });
    });

    it('returns default melee range when no weapon for ranged ability', () => {
      const ability = { id: 'ranged_pin', isRanged: true };
      const range = getEffectiveRange(ability, null);
      expect(range).toEqual({ max: 1, min: 0 });
    });
  });

  describe('getValidEnemyTargets', () => {
    it('returns only adjacent enemies', () => {
      const enemies: EntityView[] = [
        { type: 'enemy', id: 'e1', x: 5, y: 5, name: 'E1', ascii: 'g', color: '#fff', templateId: null },
        { type: 'enemy', id: 'e2', x: 6, y: 5, name: 'E2', ascii: 'g', color: '#fff', templateId: null },
        { type: 'enemy', id: 'e3', x: 8, y: 5, name: 'E3', ascii: 'g', color: '#fff', templateId: null },
      ];
      const validTargets = getValidEnemyTargets(enemies, { x: 5, y: 5 });
      expect(validTargets).toHaveLength(1);
      expect(validTargets[0]?.id).toBe('e2');
    });
  });

  describe('getAutoTargetOrShowChooser', () => {
    it('returns target when only one exists', () => {
      const targets: EntityView[] = [
        { type: 'enemy', id: 'e1', x: 6, y: 5, name: 'E1', ascii: 'g', color: '#fff', templateId: null },
      ];
      const target = getAutoTargetOrShowChooser(targets);
      expect(target?.id).toBe('e1');
    });

    it('returns null for zero targets', () => {
      expect(getAutoTargetOrShowChooser([])).toBeNull();
    });

    it('returns null for multiple targets', () => {
      const targets: EntityView[] = [
        { type: 'enemy', id: 'e1', x: 6, y: 5, name: 'E1', ascii: 'g', color: '#fff', templateId: null },
        { type: 'enemy', id: 'e2', x: 5, y: 6, name: 'E2', ascii: 'g', color: '#fff', templateId: null },
      ];
      expect(getAutoTargetOrShowChooser(targets)).toBeNull();
    });
  });

  describe('isTargetingActionEnabled', () => {
    it('returns true for self-targeted abilities', () => {
      expect(isTargetingActionEnabled('self', [])).toBe(true);
    });

    it('returns true for AOE abilities', () => {
      expect(isTargetingActionEnabled('all_visible_enemies', [])).toBe(true);
    });

    it('returns false for single-target with no targets', () => {
      expect(isTargetingActionEnabled('single_enemy', [])).toBe(false);
    });

    it('returns true for single-target with targets', () => {
      const targets: EntityView[] = [
        { type: 'enemy', id: 'e1', x: 6, y: 5, name: 'E1', ascii: 'g', color: '#fff', templateId: null },
      ];
      expect(isTargetingActionEnabled('single_enemy', targets)).toBe(true);
    });
  });

  describe('getValidDisarmableTraps', () => {
    it('returns adjacent disarmable traps', () => {
      const objects: any[] = [
        { type: 'object', id: 'o1', x: 6, y: 5, name: 'Trap', ascii: '^', color: '#f00', templateId: 'trap_spikes', isDisarmableTrap: true },
        { type: 'object', id: 'o2', x: 5, y: 6, name: 'Fire', ascii: 'f', color: '#f80', templateId: 'fire_pit', isDisarmableTrap: true },
        { type: 'object', id: 'o3', x: 8, y: 8, name: 'Chest', ascii: 'c', color: '#999', templateId: 'chest', isDisarmableTrap: false },
      ];
      const traps = getValidDisarmableTraps({ x: 5, y: 5 }, objects);
      expect(traps).toHaveLength(2);
    });
  });

  describe('getValidTrapPlacementDirections', () => {
    it('returns 8 adjacent positions when no obstacles', () => {
      const directions = getValidTrapPlacementDirections({ x: 5, y: 5 }, [], []);
      expect(directions).toHaveLength(8);
    });

    it('excludes occupied positions', () => {
      const objects: EntityView[] = [
        { type: 'object', id: 'o1', x: 6, y: 5, name: 'Chest', ascii: 'c', color: '#999', templateId: 'chest' },
      ];
      const enemies: EntityView[] = [
        { type: 'enemy', id: 'e1', x: 5, y: 6, name: 'Enemy', ascii: 'g', color: '#0f0', templateId: null },
      ];
      const directions = getValidTrapPlacementDirections({ x: 5, y: 5 }, objects, enemies);
      expect(directions).toHaveLength(6);
    });
  });
});
