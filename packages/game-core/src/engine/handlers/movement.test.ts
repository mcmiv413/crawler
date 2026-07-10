/**
 * Test layer: unit
 * Behavior: handleMove applies passive trap damage and declared status effects only when walking onto active hazardous objects, exhausts player-origin traps, and treats chests or healing fountains as non-triggering walk-over objects.
 * Proof: Assertions check position moves to the trap tile, health decreases by positive damage equal to TRAP_TRIGGERED.damage, enriched TRAP_TRIGGERED target fields, STATUS_APPLIED source fields, player-origin exhaustion, reusable environmental traps, no health change or TRAP_TRIGGERED for chest/fountain, and turnNumber increments by exactly one for trap movement.
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

function getStatusAppliedEvent(
  events: readonly DomainEvent[],
): Extract<DomainEvent, { type: 'STATUS_APPLIED' }> {
  const statusEvent = events.find(
    (event): event is Extract<DomainEvent, { type: 'STATUS_APPLIED' }> => event.type === 'STATUS_APPLIED',
  );

  if (statusEvent === undefined) {
    throw new Error('Expected STATUS_APPLIED event');
  }

  return statusEvent;
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
    const trapEvent = getTrapTriggeredEvent(result.events);
    expect(trapEvent.preHealth).toBeDefined();
    expect(trapEvent.postHealth).toBeDefined();
    const damageTaken = trapEvent.preHealth! - trapEvent.postHealth!;

    expect(result.state.player.position).toEqual(trapPosition);
    expect(healthAfter).toBeLessThan(healthBefore);
    expect(damageTaken).toBeGreaterThan(0);
    expect(trapEvent.damage).toBe(damageTaken);
    expect(trapEvent).toMatchObject({
      targetId: stateWithTrap.player.id,
      targetName: stateWithTrap.player.name,
      targetPosition: trapPosition,
      preHealth: healthBefore,
      maxHealth: stateWithTrap.player.stats.maxHealth,
      killed: false,
      trapOrigin: 'environment',
      exhausted: false,
    });
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
    expect(trapEvent.preHealth).toBeDefined();
    expect(trapEvent.postHealth).toBeDefined();
    const damageTaken = trapEvent.preHealth! - trapEvent.postHealth!;

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

  it('applies declared trap status effects through the shared status pipeline', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const trapPosition = { x: 1, y: 0 };
    const trapInstance: ObjectInstance = {
      id: entityId('poison_trap_1'),
      templateId: 'poison_trap',
      position: trapPosition,
      isExhausted: false,
    };
    const objects = new Map(state.run!.objects);
    objects.set(posKey(trapPosition), trapInstance);
    const stateWithTrap: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    const result = handleMove(stateWithTrap, 'E', new SeededRNG(42));
    const trapEvent = getTrapTriggeredEvent(result.events);
    const statusEvent = getStatusAppliedEvent(result.events);

    expect(trapEvent.statusEffect).toBe('poison');
    expect(statusEvent).toMatchObject({
      targetId: state.player.id,
      statusId: 'poison',
      sourceId: trapInstance.id,
    });
    expect(result.state.player.statuses.some(status => status.id === 'poison' && status.sourceId === trapInstance.id)).toBe(true);
  });

  it('exhausts player-origin traps after they trigger and persists the floor lifecycle state', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const trapPosition = { x: 1, y: 0 };
    const trapInstance: ObjectInstance = {
      id: entityId('player_trap_1'),
      templateId: 'trap_spikes',
      position: trapPosition,
      isExhausted: false,
      origin: 'player',
    };
    const objects = new Map(state.run!.objects);
    objects.set(posKey(trapPosition), trapInstance);
    const stateWithTrap: GameState = {
      ...state,
      run: { ...state.run!, objects },
    };

    const first = handleMove(stateWithTrap, 'E', new SeededRNG(42));
    const firstTrapEvent = getTrapTriggeredEvent(first.events);
    const exhaustedTrap = first.state.run!.objects.get(posKey(trapPosition));
    const cachedTrap = first.state.persistedFloorCache
      ?.get(first.state.run!.floor.depth)
      ?.objects.get(posKey(trapPosition));

    expect(firstTrapEvent).toMatchObject({ trapOrigin: 'player', exhausted: true });
    expect(exhaustedTrap?.isExhausted).toBe(true);
    expect(cachedTrap?.isExhausted).toBe(true);

    const movedAway = handleMove(first.state, 'W', new SeededRNG(43));
    const second = handleMove(movedAway.state, 'E', new SeededRNG(44));

    expect(second.events.some(event => event.type === 'TRAP_TRIGGERED')).toBe(false);
  });

  it('keeps environmental hazards reusable after triggering', () => {
    const state = createTestGameStateInCombat({ enemyAt: { x: 5, y: 5 } });
    const trapPosition = { x: 1, y: 0 };
    const trapInstance: ObjectInstance = {
      id: entityId('environment_trap_1'),
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

    const first = handleMove(stateWithTrap, 'E', new SeededRNG(42));
    const movedAway = handleMove(first.state, 'W', new SeededRNG(43));
    const second = handleMove(movedAway.state, 'E', new SeededRNG(44));

    expect(getTrapTriggeredEvent(first.events).exhausted).toBe(false);
    expect(first.state.run!.objects.get(posKey(trapPosition))?.isExhausted).toBe(false);
    expect(getTrapTriggeredEvent(second.events).trapId).toBe(trapInstance.id);
  });
});
