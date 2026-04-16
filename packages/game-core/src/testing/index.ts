/**
 * Testing utilities for game-core.
 * Re-exports builders, fixtures, and test helpers for use in tests.
 */
export {
  BASE_TEST_STATS,
  createTestPlayer,
  createTestEnemy,
  createTestNemesis,
  createTestRunState,
  createTestGameStateInCombat,
  createTestGameState,
  createTestGameStateWithAbility,
  createUseAbilityCommand,
  createMoveCommand,
  createMoveCommandWithDirection,
  createAttackCommand,
  createEquipCommand,
  createUseItemCommand,
  createWaitCommand,
  createRetreatCommand,
  createInteractCommand,
  createUnequipCommand,
  createSwapWeaponsCommand,
  createEnchantArmorCommand,
  createAscendCommand,
} from '../test-utils.js';
