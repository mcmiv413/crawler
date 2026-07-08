/**
 * Test layer: unit
 * Behavior: Movement covers handleMove - Trap Damage on Walk; should damage player when walking onto a trap; should emit TRAP_TRIGGERED event when stepping on trap.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/engine/handlers/movement.test.ts
 */
import { describe, it, expect } from 'vitest';
import { handleMove } from './movement.js';
import { SeededRNG } from '../../utils/rng.js';
import { entityId, posKey } from '@dungeon/contracts';
import type { DomainEvent, GameState, ObjectInstance } from '@dungeon/contracts';
import { createTestGameStateInCombat } from '../../test-utils.js';

function getTrapTriggeredEvent(
  events: readonly DomainEvent[],
): Extract<DomainEvent, { type: 'TRAP_TRIGGERED' }> {
  const trapEvent = events.find(
    (event): event is Extract<DomainEvent, { type: 'TRAP_TRIGGERED' }> => event.type === 'TRAP_TRIGGERED',
  );

  if (trapEvent === undefined) {
    throw new Error('Expected TRAP_TRIGGERED event');
  }

  return trapEvent;
}

describe('handleMove - Trap Damage on Walk', () => {
  /**
   * Test 1: Player walks onto trap tile and takes damage
   *
   * When the player moves to a tile that contains a trap (hazardous object),
   * the trap should trigger automatically and deal damage to the player.
   */
  it('should damage player when walking onto a trap', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } }); // Move enemy away
    const trapPosition = { x: 1, y: 0 };
    const trapInstance: ObjectInstance = {
      id: entityId('trap1'),
      templateId: 'trap_spikes',
      position: trapPosition,
      isExhausted: false,
    };

    // Add trap to map
    const objects = new Map(state.run!.objects);
    objects.set(posKey(trapPosition), trapInstance);
    const stateWithTrap: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    const healthBefore = stateWithTrap.player.stats.health;
    const rng = new SeededRNG(42);

    // Move player to trap location
    const result = handleMove(stateWithTrap, 'E', rng);

    // Player should take damage from trap
    const healthAfter = result.state.player.stats.health;
    const damageTaken = healthBefore - healthAfter;
    const trapEvent = getTrapTriggeredEvent(result.events);

    expect(result.state.player.position).toEqual(trapPosition);
    expect(healthAfter).toBeLessThan(healthBefore);
    expect(damageTaken).toBeGreaterThan(0);
    expect(trapEvent.damage).toBe(damageTaken);
  });

  /**
   * Test 2: Trap trigger emits TRAP_TRIGGERED event
   *
   * When a trap is triggered passively, a TRAP_TRIGGERED event should be emitted
   * with the trap name and damage amount.
   */
  it('should emit TRAP_TRIGGERED event when stepping on trap', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } }); // Move enemy away
    const trapPosition = { x: 1, y: 0 };
    const trapInstance: ObjectInstance = {
      id: entityId('trap1'),
      templateId: 'trap_spikes',
      position: trapPosition,
      isExhausted: false,
    };

    const objects = new Map(state.run!.objects);
    objects.set(posKey(trapPosition), trapInstance);
    const stateWithTrap: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    const healthBefore = stateWithTrap.player.stats.health;
    const rng = new SeededRNG(42);
    const result = handleMove(stateWithTrap, 'E', rng);

    // Find TRAP_TRIGGERED event
    const trapEvent = getTrapTriggeredEvent(result.events);
    const damageTaken = healthBefore - result.state.player.stats.health;

    expect(trapEvent.trapId).toBe(trapInstance.id);
    expect(trapEvent.trapName.length).toBeGreaterThan(0);
    expect(trapEvent.damage).toBe(damageTaken);
    expect(trapEvent.position).toEqual(trapPosition);
  });

  /**
   * Test 3: Player doesn't take damage when walking onto safe tiles
   *
   * Only hazardous objects (those with negative healthDelta) should trigger damage.
   * Safe tiles and non-hazard objects should not affect health.
   */
  it('should not damage player when walking onto non-hazard tiles', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const chestPosition = { x: 1, y: 0 };

    // Create a chest (non-hazard, non-consumable)
    const chestInstance: ObjectInstance = {
      id: entityId('chest1'),
      templateId: 'chest',
      position: chestPosition,
      isExhausted: false,
    };

    const objects = new Map(state.run!.objects);
    objects.set(posKey(chestPosition), chestInstance);
    const stateWithChest: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    const healthBefore = stateWithChest.player.stats.health;
    const rng = new SeededRNG(42);
    const result = handleMove(stateWithChest, 'E', rng);

    // No damage should be taken
    expect(result.state.player.stats.health).toBe(healthBefore);

    // No TRAP_TRIGGERED event should be emitted
    const trapEvent = result.events.find((e) => e.type === 'TRAP_TRIGGERED');
    expect(trapEvent).toBeUndefined();
  });

  /**
   * Test 4: Healing fountains (positive healthDelta) don't trigger trap event
   *
   * Fountains are interactive objects, not passive hazards. They should not
   * trigger automatically when walked on.
   */
  it('should not trigger healing fountain on walk-over', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const fountainPosition = { x: 1, y: 0 };

    const fountainInstance: ObjectInstance = {
      id: entityId('fountain1'),
      templateId: 'healing_fountain',
      position: fountainPosition,
      isExhausted: false,
    };

    const objects = new Map(state.run!.objects);
    objects.set(posKey(fountainPosition), fountainInstance);
    const stateWithFountain: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    // Damage player first
    const damagedState: GameState = {
      ...stateWithFountain,
      player: {
        ...stateWithFountain.player,
        stats: { ...stateWithFountain.player.stats, health: 30 },
      },
    };

    const healthBefore = damagedState.player.stats.health;
    const rng = new SeededRNG(42);
    const result = handleMove(damagedState, 'E', rng);

    // Fountain should not heal on walk-over
    expect(result.state.player.stats.health).toBe(healthBefore);

    // No TRAP_TRIGGERED event
    const trapEvent = result.events.find((e) => e.type === 'TRAP_TRIGGERED');
    expect(trapEvent).toBeUndefined();
  });

  /**
   * Test 5: Trap does not cost extra turns
   *
   * Walking onto a trap should only cost the normal movement action cost,
   * not additional turns. The trap damage is a passive effect of movement.
   */
  it('should not consume extra turns for trap trigger', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const trapPosition = { x: 1, y: 0 };

    const trapInstance: ObjectInstance = {
      id: entityId('trap1'),
      templateId: 'trap_spikes',
      position: trapPosition,
      isExhausted: false,
    };

    const objects = new Map(state.run!.objects);
    objects.set(posKey(trapPosition), trapInstance);
    const stateWithTrap: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    const turnsBefore = stateWithTrap.turnNumber;
    const rng = new SeededRNG(42);
    const result = handleMove(stateWithTrap, 'E', rng);

    // Should increment by 1 (normal move cost)
    expect(result.state.turnNumber).toBe(turnsBefore + 1);
  });
});
