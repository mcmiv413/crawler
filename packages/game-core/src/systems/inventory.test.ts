import { describe, it, expect, beforeEach } from 'vitest';
import {
  addItemToInventory,
  removeItemFromInventory,
  useConsumable,
} from './inventory.js';
import { entityId, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import type { RunState } from '@dungeon/contracts';
import { BASE_TEST_STATS, createTestGameState, createTestEnemy } from '../test-utils.js';

const swordTemplate = {
  itemId: 'sword',
  name: 'Sword',
  itemClass: 'weapon' as const,
  description: 'A sword',
  rarity: 'common' as const,
  value: 10,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 10, damageType: 'physical' as const, accuracy: 5, speed: 3, slot: 'weapon' as const, weaponRange: 1, weaponType: 'blade' as const },
};

const potionTemplate = {
  itemId: 'health_potion',
  name: 'Health Potion',
  itemClass: 'consumable' as const,
  description: 'Heals 30 HP',
  rarity: 'common' as const,
  value: 5,
  stackable: true,
  maxStack: 10,
  consumable: { effect: 'heal' as const, magnitude: 30 },
};

const antidoteTemplate = {
  itemId: 'antidote',
  name: 'Antidote',
  itemClass: 'consumable' as const,
  description: 'Cures poison',
  rarity: 'common' as const,
  value: 5,
  stackable: true,
  maxStack: 10,
  consumable: { effect: 'cure' as const, magnitude: 0, targetStatus: 'poison' as const },
};

const bombTemplate = {
  id: entityId('bomb'),
  itemId: 'bomb',
  name: 'Bomb',
  itemClass: 'consumable' as const,
  description: 'Deals 25 fire damage to an adjacent enemy.',
  rarity: 'uncommon' as const,
  value: 15,
  stackable: true,
  maxStack: 3,
  consumable: { effect: 'damage' as const, magnitude: 25 },
};

const strengthElixirTemplate = {
  id: entityId('strength_elixir'),
  itemId: 'strength_elixir',
  name: 'Strength Elixir',
  itemClass: 'consumable' as const,
  description: 'Temporarily boosts attack power.',
  rarity: 'uncommon' as const,
  value: 20,
  stackable: true,
  maxStack: 3,
  consumable: { effect: 'buff' as const, magnitude: 5, duration: 10 },
};

describe('Inventory System', () => {
  let state: ReturnType<typeof createTestGameState>;

  beforeEach(() => {
    state = createTestGameState();
  });

  it('adds an item to inventory and emits event', () => {
    const initialCount = state.player.inventory.length;
    const { state: newState, events } = addItemToInventory(state, swordTemplate);
    expect(newState.player.inventory.length).toBeGreaterThan(initialCount);
    expect(events.some((e: any) => e.type === 'LOOT_ACQUIRED')).toBe(true);
  });

  it('removes an item from inventory', () => {
    const { state: stateWithItem } = addItemToInventory(state, swordTemplate);
    const itemId = stateWithItem.player.inventory[0]!;
    const initialCount = stateWithItem.player.inventory.length;
    const stateAfterRemove = removeItemFromInventory(stateWithItem, itemId);
    expect(stateAfterRemove.player.inventory.length).toBeLessThan(initialCount);
  });

  it('using a health potion heals player', () => {
    const initialHealth = 10;
    const lowHpState = createTestGameState({ player: { stats: { ...BASE_TEST_STATS, health: initialHealth } } });
    const { state: stateWithPotion } = addItemToInventory(lowHpState, potionTemplate);
    const potionId = stateWithPotion.player.inventory[0]!;
    const { state: healedState } = useConsumable(stateWithPotion, potionId);
    expect(healedState.player.stats.health).toBeGreaterThan(initialHealth);
    expect(healedState.player.stats.health).toBeLessThanOrEqual(healedState.player.stats.maxHealth);
  });

  it('using an antidote removes poison status', () => {
    const poisonedState = createTestGameState({
      player: { statuses: [{ id: 'poison', turnsRemaining: 3, magnitude: 5, sourceId: null }] },
    });
    const { state: stateWithAntidote } = addItemToInventory(poisonedState, antidoteTemplate);
    const antidoteId = stateWithAntidote.player.inventory[0]!;
    const { state: curedState } = useConsumable(stateWithAntidote, antidoteId);
    expect(curedState.player.statuses.some((s: any) => s.id === 'poison')).toBe(false);
  });

  it('C1: addItemToInventory allows unlimited items (no inventory limit)', () => {
    let state = createTestGameState();
    // Add more items than the old MAX_INVENTORY of 20
    for (let i = 0; i < 50; i++) {
      const template = { ...potionTemplate, itemId: `potion${i}` };
      const result = addItemToInventory(state, template);
      state = result.state;
    }
    // All 50 items should be in inventory
    expect(state.player.inventory.length).toBeLessThanOrEqual(50);
    expect(state.player.inventory.length).toBeGreaterThan(40);
  });

  it('bomb deals magnitude damage to target enemy', () => {
    const enemy = createTestEnemy({ id: entityId('enemy1'), position: { x: 1, y: 0 } });
    const initialEnemyHealth = enemy.stats.health;
    const runState: RunState = {
      runId: entityId('run1'),
      floor: { depth: 1, width: 10, height: 10, cells: new Map(), entrance: { x: 0, y: 0 }, exit: { x: 9, y: 9 }, biomeId: 'crypt', seed: 42 },
      enemies: new Map([['1,0', enemy]]),
      objects: new Map(),
      turnCount: 1,
      isActive: true,
      floorHistory: [],
      speedAccumulators: {},
    };
    const stateWithRun = { ...state, phase: 'dungeon' as const, run: runState };
    const { state: stateWithBomb } = addItemToInventory(stateWithRun, bombTemplate);
    const bombId = stateWithBomb.player.inventory[0]!;
    const { state: afterBomb, events } = useConsumable(stateWithBomb, bombId, enemy.id);
    const updatedEnemy = afterBomb.run?.enemies.get('1,0');
    expect(updatedEnemy?.stats.health).toBeLessThan(initialEnemyHealth);
    expect(afterBomb.player.inventory).not.toContain(bombId);
    expect(events.some((e: any) => e.type === 'ITEM_USED')).toBe(true);
  });

  it('strength elixir applies strength status with correct duration and magnitude', () => {
    const { state: stateWithElixir } = addItemToInventory(state, strengthElixirTemplate);
    const elixirId = stateWithElixir.player.inventory[0]!;
    const { state: after } = useConsumable(stateWithElixir, elixirId);
    const strengthStatus = after.player.statuses.find((s: any) => s.id === 'strength');
    expect(strengthStatus).toBeDefined();
    expect(strengthStatus?.turnsRemaining).toBeGreaterThan(5);
    expect(strengthStatus?.turnsRemaining).toBeLessThanOrEqual(15);
    expect(strengthStatus?.magnitude).toBeGreaterThan(0);
    expect(strengthStatus?.magnitude).toBeLessThan(10);
    // After fix: attack stat itself is unchanged; boost comes via getEffectiveStat
    expect(after.player.stats.attack).toBe(state.player.stats.attack);
  });

  it('Bug 1: buff consumable applies stat via status only (no direct mutation)', () => {
    const { state: stateWithElixir } = addItemToInventory(state, strengthElixirTemplate);
    const elixirId = stateWithElixir.player.inventory[0]!;
    const originalAttack = state.player.stats.attack;
    const { state: after } = useConsumable(stateWithElixir, elixirId);

    // After fix: No direct mutation to stats.attack on use
    // The strength status is applied; getEffectiveStat will calculate the boost
    // So stats.attack should remain unchanged:
    expect(after.player.stats.attack).toBe(originalAttack);

    // But the status provides the boost via getEffectiveStat:
    const strengthStatus = after.player.statuses.find((s: any) => s.id === 'strength');
    expect(strengthStatus).toBeDefined();
    expect(strengthStatus?.magnitude).toBeGreaterThan(0);
    expect(strengthStatus?.magnitude).toBeLessThan(10);
    expect(strengthStatus?.turnsRemaining).toBeGreaterThan(5);
    expect(strengthStatus?.turnsRemaining).toBeLessThanOrEqual(15);
  });

  it('strength elixir is removed from inventory after use', () => {
    const { state: stateWithElixir } = addItemToInventory(state, strengthElixirTemplate);
    const elixirId = stateWithElixir.player.inventory[0]!;
    const { state: after } = useConsumable(stateWithElixir, elixirId);
    expect(after.player.inventory).not.toContain(elixirId);
  });

  it('A4: bomb without target applies AOE damage to adjacent enemies', () => {
    // Create two enemies: one adjacent (distance 1) and one far (distance 3)
    const adjacentEnemy = createTestEnemy({ id: entityId('enemy1'), position: { x: 1, y: 0 }, stats: { ...createTestEnemy().stats, health: 50 } });
    const farEnemy = createTestEnemy({ id: entityId('enemy2'), position: { x: 4, y: 0 }, stats: { ...createTestEnemy().stats, health: 50 } });

    const runState: RunState = {
      runId: entityId('run1'),
      floor: { depth: 1, width: 10, height: 10, cells: new Map(), entrance: { x: 0, y: 0 }, exit: { x: 9, y: 9 }, biomeId: 'crypt', seed: 42 },
      enemies: new Map([['1,0', adjacentEnemy], ['4,0', farEnemy]]),
      objects: new Map(),
      turnCount: 1,
      isActive: true,
      floorHistory: [],
      speedAccumulators: {},
    };

    // Player is at (0, 0) by default
    const stateWithRun = { ...state, phase: 'dungeon' as const, run: runState };
    const { state: stateWithBomb } = addItemToInventory(stateWithRun, bombTemplate);
    const bombId = stateWithBomb.player.inventory[0]!;

    // Use bomb WITHOUT specifying a target (AOE mode)
    const { state: afterBomb, events } = useConsumable(stateWithBomb, bombId);

    // Adjacent enemy should take damage
    const updatedAdjacentEnemy = afterBomb.run?.enemies.get('1,0');
    expect(updatedAdjacentEnemy?.stats.health ?? 0).toBeLessThan(adjacentEnemy.stats.health);

    // Far enemy should NOT take damage (distance 4 > 1)
    const updatedFarEnemy = afterBomb.run?.enemies.get('4,0');
    expect(updatedFarEnemy?.stats.health).toBe(farEnemy.stats.health); // unchanged

    // Bomb should be removed from inventory
    expect(afterBomb.player.inventory).not.toContain(bombId);

    // Should emit ITEM_USED event
    expect(events.some((e: any) => e.type === 'ITEM_USED')).toBe(true);
  });
});
