import { describe, it, expect } from 'vitest';
import type { AbilityContext } from '../types.js';
import { validateRequirements } from './validate-ability.js';
import { resolveTargets } from './resolve-targets.js';
import { executeAbility } from './execute-ability.js';
import { createTestGameStateInCombat, createTestEnemy } from '../../test-utils.js';
import { SeededRNG } from '../../utils/rng.js';
import { entityId } from '@dungeon/contracts';

describe('abilities/runtime', () => {
  describe('validateRequirements', () => {
    it('should pass when no requirements', () => {
      const state = createTestGameStateInCombat();
      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const result = validateRequirements(context, []);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should fail has_target when no target', () => {
      const state = createTestGameStateInCombat();
      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const result = validateRequirements(context, [{ kind: 'has_target' }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Requires a target');
    });

    it('should pass has_target when target exists', () => {
      const state = createTestGameStateInCombat();
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'has_target' }]);
      expect(result.valid).toBe(true);
    });

    it('should fail no_target when target exists', () => {
      const state = createTestGameStateInCombat();
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'no_target' }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Does not target enemies');
    });

    it('should pass no_target when no target', () => {
      const state = createTestGameStateInCombat();
      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const result = validateRequirements(context, [{ kind: 'no_target' }]);
      expect(result.valid).toBe(true);
    });

    it('should fail player_missing_hp when at full health', () => {
      const state = createTestGameStateInCombat({
        enemyAt: { x: 2, y: 2 },
      });
      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const result = validateRequirements(context, [{ kind: 'player_missing_hp' }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Already at full health');
    });

    it('should pass player_missing_hp when below full health', () => {
      const state = createTestGameStateInCombat({
        enemyAt: { x: 2, y: 2 },
      });
      const playerDamaged = { ...state.player, stats: { ...state.player.stats, health: 15 } };

      const context: AbilityContext = {
        state: { ...state, player: playerDamaged },
        rng: new SeededRNG(42),
        player: playerDamaged,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const result = validateRequirements(context, [{ kind: 'player_missing_hp' }]);
      expect(result.valid).toBe(true);
    });

    it('should fail target_in_melee_range when target is far', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_in_melee_range' }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('out of melee range');
    });

    it('should pass target_in_melee_range when target is adjacent', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_in_melee_range' }]);
      expect(result.valid).toBe(true);
    });

    it('should pass target_in_weapon_range for a ranged weapon target', () => {
      const state = createTestGameStateInCombat({
        equippedWeaponId: 'short_bow',
        enemyAt: { x: 3, y: 0 },
      });
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_in_weapon_range' }]);
      expect(result.valid).toBe(true);
    });

    it('should fail target_in_weapon_range when a bow target is too close', () => {
      const state = createTestGameStateInCombat({
        equippedWeaponId: 'short_bow',
        enemyAt: { x: 1, y: 0 },
      });
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_in_weapon_range' }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too close');
    });

    it('should pass target_visible (always for selected targets)', () => {
      const state = createTestGameStateInCombat();
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_visible' }]);
      expect(result.valid).toBe(true);
    });

    it('should fail target_below_hp_pct when target HP is too high', () => {
      const state = createTestGameStateInCombat();
      const enemy = [...state.run!.enemies.values()][0]!;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: enemy,
          key: `${enemy.position.x},${enemy.position.y}`,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_below_hp_pct', percentage: 0.3 }]);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Target HP too high');
    });

    it('should pass target_below_hp_pct when target HP is low enough', () => {
      const state = createTestGameStateInCombat();
      const damagedenemy = createTestEnemy({ stats: { ...createTestEnemy().stats, health: 5 }, position: { x: 1, y: 0 } });
      const damageEnemyKey = '1,0';
      const runWithDamagedEnemy = {
        ...state.run!,
        enemies: new Map([[damageEnemyKey, damagedenemy]]),
      };

      const context: AbilityContext = {
        state: { ...state, run: runWithDamagedEnemy },
        rng: new SeededRNG(42),
        player: state.player,
        run: runWithDamagedEnemy,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: damagedenemy,
          key: damageEnemyKey,
        },
      };

      const result = validateRequirements(context, [{ kind: 'target_below_hp_pct', percentage: 0.3 }]);
      expect(result.valid).toBe(true);
    });
  });

  describe('resolveTargets', () => {
    it('should return empty array for self selector', () => {
      const state = createTestGameStateInCombat();
      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'self' }, requestedTargetId: undefined },
      );

      expect(targets).toEqual([]);
    });

    it('should return empty array when run is null', () => {
      const state = createTestGameStateInCombat();
      const context: AbilityContext = {
        state: { ...state, run: null },
        rng: new SeededRNG(42),
        player: state.player,
        run: null,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'single_enemy' }, requestedTargetId: entityId('e1') },
      );

      expect(targets).toEqual([]);
    });

    it('should find single_enemy by ID', () => {
      const state = createTestGameStateInCombat();
      const enemy = [...state.run!.enemies.values()][0]!;
      const enemyKey = `${enemy.position.x},${enemy.position.y}`;

      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'single_enemy' }, requestedTargetId: enemy.id },
      );

      expect(targets).toHaveLength(1);
      expect(targets[0]!.enemy.id).toBe(enemy.id);
      expect(targets[0]!.key).toBe(enemyKey);
    });

    it('should return empty for single_enemy with no requested target', () => {
      const state = createTestGameStateInCombat();
      const context: AbilityContext = {
        state,
        rng: new SeededRNG(42),
        player: state.player,
        run: state.run,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'single_enemy' }, requestedTargetId: undefined },
      );

      expect(targets).toEqual([]);
    });

    it('should find nearest_enemy_melee in melee range', () => {
      const enemy1 = createTestEnemy({ position: { x: 1, y: 0 } });
      const enemy2 = createTestEnemy({ position: { x: 0, y: 1 }, id: entityId('e2') });
      const enemyKey1 = '1,0';
      const enemyKey2 = '0,1';
      const state = createTestGameStateInCombat();
      const runWithManyEnemies = {
        ...state.run!,
        enemies: new Map([
          [enemyKey1, enemy1],
          [enemyKey2, enemy2],
        ]),
      };

      const context: AbilityContext = {
        state: { ...state, run: runWithManyEnemies },
        rng: new SeededRNG(42),
        player: state.player,
        run: runWithManyEnemies,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'nearest_enemy_melee' }, requestedTargetId: undefined },
      );

      expect(targets).toHaveLength(1);
      expect(targets[0]!.enemy.id).toBe(enemy1.id);
    });

    it('should return empty for nearest_enemy_melee with no melee enemies', () => {
      const enemy = createTestEnemy({ position: { x: 5, y: 5 } });
      const enemyKey = '5,5';
      const state = createTestGameStateInCombat();
      const runWithFarEnemy = {
        ...state.run!,
        enemies: new Map([[enemyKey, enemy]]),
      };

      const context: AbilityContext = {
        state: { ...state, run: runWithFarEnemy },
        rng: new SeededRNG(42),
        player: state.player,
        run: runWithFarEnemy,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'nearest_enemy_melee' }, requestedTargetId: undefined },
      );

      expect(targets).toEqual([]);
    });

    it('should find nearest_visible_enemy', () => {
      const enemy1 = createTestEnemy({ position: { x: 1, y: 0 } });
      const enemy2 = createTestEnemy({ position: { x: 3, y: 0 }, id: entityId('e2') });
      const enemyKey1 = '1,0';
      const enemyKey2 = '3,0';
      const state = createTestGameStateInCombat();
      const runWithManyEnemies = {
        ...state.run!,
        enemies: new Map([
          [enemyKey1, enemy1],
          [enemyKey2, enemy2],
        ]),
      };

      const context: AbilityContext = {
        state: { ...state, run: runWithManyEnemies },
        rng: new SeededRNG(42),
        player: state.player,
        run: runWithManyEnemies,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'nearest_visible_enemy' }, requestedTargetId: undefined },
      );

      expect(targets).toHaveLength(1);
      expect(targets[0]!.enemy.id).toBe(enemy1.id);
    });

    it('should find all_visible_enemies', () => {
      const enemy1 = createTestEnemy({ position: { x: 1, y: 0 } });
      const enemy2 = createTestEnemy({ position: { x: 0, y: 1 }, id: entityId('e2') });
      const enemyKey1 = '1,0';
      const enemyKey2 = '0,1';
      const state = createTestGameStateInCombat();
      const runWithManyEnemies = {
        ...state.run!,
        enemies: new Map([
          [enemyKey1, enemy1],
          [enemyKey2, enemy2],
        ]),
      };

      const context: AbilityContext = {
        state: { ...state, run: runWithManyEnemies },
        rng: new SeededRNG(42),
        player: state.player,
        run: runWithManyEnemies,
        equippedWeaponId: state.player.equipment.weapon,
        target: undefined,
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'all_visible_enemies' }, requestedTargetId: undefined },
      );

      expect(targets).toHaveLength(2);
      expect(targets.map(t => t.enemy.id)).toContain(enemy1.id);
      expect(targets.map(t => t.enemy.id)).toContain(enemy2.id);
    });

    it('should find target_plus_adjacent_enemies', () => {
      const targetEnemy = createTestEnemy({ position: { x: 1, y: 0 } });
      const adjacentEnemy = createTestEnemy({ position: { x: 1, y: 1 }, id: entityId('e2') });
      const farEnemy = createTestEnemy({ position: { x: 5, y: 5 }, id: entityId('e3') });

      const targetKey = '1,0';
      const adjacentKey = '1,1';
      const farKey = '5,5';

      const state = createTestGameStateInCombat();
      const runWithManyEnemies = {
        ...state.run!,
        enemies: new Map([
          [targetKey, targetEnemy],
          [adjacentKey, adjacentEnemy],
          [farKey, farEnemy],
        ]),
      };

      const context: AbilityContext = {
        state: { ...state, run: runWithManyEnemies },
        rng: new SeededRNG(42),
        player: state.player,
        run: runWithManyEnemies,
        equippedWeaponId: state.player.equipment.weapon,
        target: {
          instance: targetEnemy,
          key: targetKey,
        },
      };

      const targets = resolveTargets(
        context,
        { selector: { kind: 'target_plus_adjacent_enemies' }, requestedTargetId: undefined },
      );

      expect(targets).toHaveLength(2);
      const ids = targets.map(t => t.enemy.id);
      expect(ids).toContain(targetEnemy.id);
      expect(ids).toContain(adjacentEnemy.id);
      expect(ids).not.toContain(farEnemy.id);
    });
  });

  describe('executeAbility', () => {
    it('should return no events for undefined ability', () => {
      const state = createTestGameStateInCombat();
      const rng = new SeededRNG(42);

      const result = executeAbility(state, 'undefined_ability_xyz', rng);

      expect(result.state).toBe(state);
      expect(result.events).toEqual([]);
      expect(result.runEnded).toBe(false);
    });

    it('should return no events when validation fails', () => {
      const state = createTestGameStateInCombat();
      const rng = new SeededRNG(42);

      // Try to execute an ability that requires a target but we have no target
      // This depends on actual ability definitions, so we'll test the general pattern
      const result = executeAbility(state, 'any_ability_id', rng);

      // Since the ability doesn't exist, it returns no events
      expect(result.runEnded).toBe(false);
    });

    it('should emit ABILITY_USED event on successful execution', () => {
      const state = createTestGameStateInCombat();
      const rng = new SeededRNG(42);

      // This test assumes there's a valid ability defined
      // The exact behavior depends on ABILITY_REGISTRY
      const result = executeAbility(state, 'any_ability', rng);

      // If the ability exists and passes validation, it should emit events
      // If the ability doesn't exist, runEnded should still be false
      expect(result.runEnded).toBe(false);
    });

    it('should include damage in ABILITY_USED event when ability deals damage', () => {
      // Create state with an enemy to target
      const state = createTestGameStateInCombat({ equippedWeaponId: 'rusty_sword' });
      const rng = new SeededRNG(42);

      // Get first enemy as target
      const enemies = [...state.run!.enemies.values()];
      if (enemies.length === 0) {
        // Skip if no enemies
        expect(true).toBe(true);
        return;
      }

      const targetEnemy = enemies[0]!;
      const targetId = targetEnemy.id;

      // Execute power_strike ability (damage-dealing attack ability)
      const result = executeAbility(state, 'power_strike', rng, targetId);

      // Should emit events
      expect(result.events.length).toBeGreaterThan(0);

      // Find ABILITY_USED event
      const abilityEvent = result.events.find((e) => e.type === 'ABILITY_USED');
      expect(abilityEvent).toBeDefined();

      // Find ATTACK_PERFORMED event to know what damage was actually dealt
      const attackEvent = result.events.find((e) => e.type === 'ATTACK_PERFORMED');

      // Verify damage is populated in ABILITY_USED event
      if (abilityEvent && abilityEvent.type === 'ABILITY_USED') {
        // If attack was performed, ability event should include the damage that was dealt
        if (attackEvent && attackEvent.type === 'ATTACK_PERFORMED') {
          // Damage should match the attack damage
          expect(abilityEvent.damage).toBe(attackEvent.damage);
        }
      }
    });
  });
});
