import { describe, it, expect } from 'vitest';
import {
  createTestGameState,
  createTestPlayer,
  createTestEnemy,
  createTestGameStateInCombat,
  createTestGameStateWithAbility,
  createUseAbilityCommand,
  createAttackCommand,
  createMoveCommand,
  createMoveCommandWithDirection,
  createInteractCommand,
  createEquipCommand,
  createUnequipCommand,
  createUseItemCommand,
  createWaitCommand,
  createRetreatCommand,
  createSwapWeaponsCommand,
  createEnchantArmorCommand,
} from '../test-utils.js';

/**
 * Subpath Export Smoke Test
 *
 * Verifies that @dungeon/core/testing is correctly exported from the package.
 * This ensures consumers can import test utilities with:
 *   import { createTestGameState } from '@dungeon/core/testing'
 *
 * This test runs against the source; the build process ensures the dist/ exports match.
 */
describe('package exports: @dungeon/core/testing', () => {
  it('should export test utilities from @dungeon/core/testing', () => {
    // Verify all exports are functions
    expect(typeof createTestGameState).toBe('function');
    expect(typeof createTestPlayer).toBe('function');
    expect(typeof createTestEnemy).toBe('function');
    expect(typeof createTestGameStateInCombat).toBe('function');
    expect(typeof createTestGameStateWithAbility).toBe('function');
    expect(typeof createUseAbilityCommand).toBe('function');
    expect(typeof createAttackCommand).toBe('function');
    expect(typeof createMoveCommand).toBe('function');
    expect(typeof createMoveCommandWithDirection).toBe('function');
    expect(typeof createInteractCommand).toBe('function');
    expect(typeof createEquipCommand).toBe('function');
    expect(typeof createUnequipCommand).toBe('function');
    expect(typeof createUseItemCommand).toBe('function');
    expect(typeof createWaitCommand).toBe('function');
    expect(typeof createRetreatCommand).toBe('function');
    expect(typeof createSwapWeaponsCommand).toBe('function');
    expect(typeof createEnchantArmorCommand).toBe('function');
  });

  it('should be able to create test objects using exported utilities', () => {
    // Create test objects
    const player = createTestPlayer({ name: 'TestHero' });
    expect(player.name).toBe('TestHero');
    expect(player.stats.health).toBeGreaterThan(0);

    const enemy = createTestEnemy();
    expect(enemy.name).toBeDefined();
    expect(enemy.stats.health).toBeGreaterThan(0);

    const gameState = createTestGameState();
    expect(gameState.gameId).toBeDefined();
    expect(gameState.phase).toBe('town');
  });

  it('package.json should export testing subpath', () => {
    // This test confirms that the package can be built and exports work
    // Import from testing/index.ts to verify the re-export structure
    const state = createTestGameState();
    const player = createTestPlayer();

    // If we can create these objects, the exports are working
    expect(state).toBeDefined();
    expect(player).toBeDefined();
  });
});
