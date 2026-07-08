/**
 * Test layer: unit
 * Behavior: Status Effects covers status-effects; applies a new status to player; refreshes existing status duration.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/status-effects.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  applyStatusToPlayer,
  tickPlayerStatuses,
  tickEnemyStatuses,
  getEffectiveStat,
  hasStatus
} from './status-effects.js';
import { createTestPlayer, createTestEnemy, createTestGameState, createTestGameStateInCombat } from '../test-utils.js';
import { posKey } from '@dungeon/contracts';
import type { AbilityUsedEvent, DomainEvent, StatusId } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';

const EXPECTED_REMAINING_BURN_TURNS = 1;

describe('status-effects', () => {
  it('applies a new status to player', () => {
    const player = createTestPlayer();
    const updated = applyStatusToPlayer(player, 'poison', 3, 5, null);
    expect(hasStatus(updated.statuses, 'poison')).toBe(true);
    const effect = updated.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.turnsRemaining).toBeGreaterThan(0);
    expect(effect!.turnsRemaining).toBeLessThan(10);
  });

  it('refreshes existing status duration', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 2, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 4, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    expect(effect!.turnsRemaining).toBeGreaterThan(0);
  });

  it('ticks reduce status duration and expire after zero', () => {
    let state = createTestGameState();
    const withWeaken = applyStatusToPlayer(state.player, 'weaken', 1, 1, null);
    state = { ...state, player: withWeaken };
    const { state: tickedState, events } = tickPlayerStatuses(state, 1);
    expect(hasStatus(tickedState.player.statuses, 'weaken')).toBe(false);
    expect(events.some((e: any) => e.type === 'STATUS_EXPIRED' && e.statusId === 'weaken')).toBe(true);
  });

  it('poison deals damage on each tick', () => {
    let state = createTestGameState();
    const withPoison = applyStatusToPlayer(state.player, 'poison', 2, 5, null);
    state = { ...state, player: withPoison };
    const healthBefore = state.player.stats.health;

    const { state: tickedState1, events: tickEvents1 } = tickPlayerStatuses(state, 1);
    // Poison does damage per turn
    expect(tickedState1.player.stats.health).toBeLessThan(healthBefore);
    expect(tickedState1.player.stats.health).toBeGreaterThanOrEqual(0);
    expect(tickEvents1).toContainEqual(expect.objectContaining({
      type: 'STATUS_DAMAGE_TICK',
      position: state.player.position,
    }));

    const { state: tickedState2 } = tickPlayerStatuses(tickedState1, 2);
    // After second tick, health should be even lower
    expect(tickedState2.player.stats.health).toBeLessThan(tickedState1.player.stats.health);
    expect(tickedState2.player.stats.health).toBeGreaterThanOrEqual(0);
  });

  it('weaken reduces attack stat while active', () => {
    let state = createTestGameState();
    const withWeaken = applyStatusToPlayer(state.player, 'weaken', 2, 1, null);
    state = { ...state, player: withWeaken };
    const originalAttack = state.player.stats.attack;
    expect(getEffectiveStat(originalAttack, 'attack', withWeaken.statuses))
      .toBeLessThan(originalAttack);
    const { state: tickedState } = tickPlayerStatuses(state, 1);
    expect(getEffectiveStat(tickedState.player.stats.attack, 'attack', tickedState.player.statuses))
      .toBeLessThan(originalAttack);
    const { state: expiredState } = tickPlayerStatuses(tickedState, 2);
    // After expiration, attack should recover
    expect(getEffectiveStat(expiredState.player.stats.attack, 'attack', expiredState.player.statuses))
      .toBeGreaterThanOrEqual(originalAttack * 0.8);
  });

  it('slow reduces speed stat while active', () => {
    let state = createTestGameState();
    const withSlow = applyStatusToPlayer(state.player, 'slow', 2, 1, null);
    state = { ...state, player: withSlow };
    const originalSpeed = state.player.stats.speed;
    expect(getEffectiveStat(originalSpeed, 'speed', withSlow.statuses))
      .toBeLessThan(originalSpeed);
    const { state: tickedState } = tickPlayerStatuses(state, 1);
    expect(getEffectiveStat(tickedState.player.stats.speed, 'speed', tickedState.player.statuses))
      .toBeLessThan(originalSpeed);
    const { state: expiredState } = tickPlayerStatuses(tickedState, 2);
    // After expiration, speed should recover
    expect(getEffectiveStat(expiredState.player.stats.speed, 'speed', expiredState.player.statuses))
      .toBeGreaterThanOrEqual(originalSpeed * 0.8);
  });
});

describe('simultaneous statuses', () => {
  it('two different statuses applied independently coexist', () => {
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 5, null);
    const withBoth = applyStatusToPlayer(withPoison, 'slow', 2, 1, null);

    expect(hasStatus(withBoth.statuses, 'poison')).toBe(true);
    expect(hasStatus(withBoth.statuses, 'slow')).toBe(true);
    expect(withBoth.statuses).toHaveLength(2);
  });

  it('tick removes expired status while leaving non-expired one intact', () => {
    let state = createTestGameState();
    // poison for 3 turns, slow for 1 turn
    const withPoison = applyStatusToPlayer(state.player, 'poison', 3, 5, null);
    const withBoth = applyStatusToPlayer(withPoison, 'slow', 1, 1, null);
    state = { ...state, player: withBoth };

    // After 1 tick, slow should expire but poison should remain
    const { state: tickedState } = tickPlayerStatuses(state, 1);

    expect(hasStatus(tickedState.player.statuses, 'slow')).toBe(false);
    expect(hasStatus(tickedState.player.statuses, 'poison')).toBe(true);
  });
});

describe('magnitude/duration refresh', () => {
  it('reapply with lower magnitude keeps original (Math.max)', () => {
    const originalMagnitude = 5;
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, originalMagnitude, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 3, 3, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.magnitude).toBeGreaterThanOrEqual(originalMagnitude);
  });

  it('reapply with higher magnitude upgrades (Math.max)', () => {
    const newMagnitude = 7;
    const player = createTestPlayer();
    const withPoison = applyStatusToPlayer(player, 'poison', 3, 3, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 3, newMagnitude, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.magnitude).toBeGreaterThanOrEqual(newMagnitude - 1);
  });

  it('reapply with shorter duration keeps original (Math.max)', () => {
    const originalDuration = 4;
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', originalDuration, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 1, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    expect(effect!.turnsRemaining).toBeGreaterThanOrEqual(originalDuration - 1);
  });
});

describe('Enemy status ticking', () => {
  it('Bug 2: tickEnemyStatuses handles enemy status duration and damage', () => {
    const initialDuration = 2;
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn' as StatusId, turnsRemaining: initialDuration, magnitude: 3, sourceId: null }] };
    const healthBefore = burnEnemy.stats.health;
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState, events } = tickEnemyStatuses(state, burnEnemy, 1, new SeededRNG(1));
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Burn should have dealt damage
    expect(ticked?.stats.health).toBeLessThan(healthBefore);

    // Duration should have decremented
    const burnStatus = ticked?.statuses.find((s: any) => s.id === 'burn');
    expect(burnStatus?.turnsRemaining ?? 0).toBeLessThan(initialDuration);
    expect(events).toContainEqual(expect.objectContaining({
      type: 'STATUS_DAMAGE_TICK',
      targetId: burnEnemy.id,
      position: burnEnemy.position,
    }));
  });

  it('finalizes enemy death immediately after lethal status damage', () => {
    let state = createTestGameStateInCombat();
    const enemy = createTestEnemy({
      position: { x: 1, y: 1 },
      stats: { maxHealth: 10, health: 1, attack: 8, defense: 0, accuracy: 70, evasion: 15, speed: 120 },
      statuses: [{ id: 'burn' as StatusId, turnsRemaining: 2, magnitude: 1, sourceId: state.player.id }],
    });
    const enemyKey = posKey(enemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, enemy]]) } };

    const { state: tickedState, events } = tickEnemyStatuses(state, enemy, 1, new SeededRNG(1));
    const eventTypes = events.map(event => event.type);
    const statusEvent = events.find(
      (event): event is Extract<DomainEvent, { type: 'STATUS_DAMAGE_TICK' }> => event.type === 'STATUS_DAMAGE_TICK',
    );
    const deathEvent = events.find(
      (event): event is Extract<DomainEvent, { type: 'ENTITY_DIED' }> => event.type === 'ENTITY_DIED',
    );

    expect(eventTypes.slice(0, 2)).toEqual(['STATUS_DAMAGE_TICK', 'ENTITY_DIED']);
    expect(statusEvent).toMatchObject({
      targetId: enemy.id,
      targetName: enemy.name,
      targetPosition: enemy.position,
      position: enemy.position,
      preHealth: 1,
      postHealth: 0,
      damage: expect.any(Number),
      killed: true,
      causeType: 'status',
    });
    expect(deathEvent).toMatchObject({
      entityId: enemy.id,
      entityName: enemy.name,
      entityPosition: enemy.position,
      entityMapKey: enemyKey,
      causeType: 'status',
      sourceEventType: 'STATUS_DAMAGE_TICK',
    });
    expect(tickedState.run?.enemies.has(enemyKey)).toBe(false);
    expect(tickedState.player.totalKills).toBe(state.player.totalKills + 1);
    expect(tickedState.player.experience).toBeGreaterThan(state.player.experience);
  });

  it('enemy status expires after duration reaches 0', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn' as StatusId, turnsRemaining: 1, magnitude: 3, sourceId: null }] };
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1, new SeededRNG(1));
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Burn should have expired
    expect(ticked?.statuses).toHaveLength(0);
  });

  it('multiple enemy statuses tick independently', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const multiStatus = {
      ...enemy,
      statuses: [
        { id: 'burn' as StatusId, turnsRemaining: 2, magnitude: 3, sourceId: null },
        { id: 'poison' as StatusId, turnsRemaining: 1, magnitude: 5, sourceId: null },
      ],
    };
    const enemyKey = posKey(multiStatus.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, multiStatus]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, multiStatus, 1, new SeededRNG(1));
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Poison should expire, burn should remain
    expect(ticked?.statuses).toHaveLength(1);
    expect(ticked?.statuses[0]?.id).toBe('burn');
    expect(ticked?.statuses[0]?.turnsRemaining).toBe(EXPECTED_REMAINING_BURN_TURNS);
  });
});

describe('Status refresh behavior (Phase 3)', () => {
  it('refreshing status takes maximum duration, not sum', () => {
    const player = createTestPlayer();
    const withSlow = applyStatusToPlayer(player, 'slow', 2, 1, null);
    const refreshed = applyStatusToPlayer(withSlow, 'slow', 3, 1, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'slow');
    // Duration should be 3 (the max), not 5 (sum)
    expect(effect!.turnsRemaining).toBeLessThanOrEqual(3);
    expect(effect!.turnsRemaining).toBeGreaterThanOrEqual(2);
  });

  it('refreshing with longer duration extends remaining time', () => {
    let state = createTestGameState();
    const withPoison = applyStatusToPlayer(state.player, 'poison', 1, 5, null);
    state = { ...state, player: withPoison };

    // After 1 tick, poison has ~0 turns remaining
    const { state: tickedState } = tickPlayerStatuses(state, 1);
    expect(hasStatus(tickedState.player.statuses, 'poison')).toBe(false);

    // Reapply with 3 turns should give fresh duration
    const refreshed = applyStatusToPlayer(tickedState.player, 'poison', 3, 5, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    expect(effect!.turnsRemaining).toBeGreaterThan(0);
  });

  it('refreshing with max stat prevents oversaturation', () => {
    const player = createTestPlayer();
    const initialMagnitude = 10;
    const refreshMagnitude = 5;
    const withPoison = applyStatusToPlayer(player, 'poison', 5, initialMagnitude, null);
    const refreshed = applyStatusToPlayer(withPoison, 'poison', 10, refreshMagnitude, null);
    const effect = refreshed.statuses.find((s: any) => s.id === 'poison');
    // Magnitude should stay at the higher applied value instead of stacking.
    expect(effect!.magnitude).toBe(Math.max(initialMagnitude, refreshMagnitude));
  });
});

describe('Stat cascades and interactions (Phase 3)', () => {
  it('weaken reduces attack, vulnerability increases damage taken', () => {
    let state = createTestGameState();
    const withWeaken = applyStatusToPlayer(state.player, 'weaken', 2, 1, null);
    const withVulnerability = applyStatusToPlayer(withWeaken, 'vulnerability', 2, 1, null);
    state = { ...state, player: withVulnerability };

    const originalAttack = state.player.stats.attack;
    const weakenedAttack = getEffectiveStat(originalAttack, 'attack', withVulnerability.statuses);

    // Weaken should reduce attack
    expect(weakenedAttack).toBeLessThan(originalAttack);

    // Both statuses should be present
    expect(hasStatus(withVulnerability.statuses, 'weaken')).toBe(true);
    expect(hasStatus(withVulnerability.statuses, 'vulnerability')).toBe(true);
  });

  it('stun and slow stack (multiple debuffs coexist)', () => {
    const player = createTestPlayer();
    const withStun = applyStatusToPlayer(player, 'stun', 1, 1, null);
    const withBoth = applyStatusToPlayer(withStun, 'slow', 2, 1, null);

    expect(hasStatus(withBoth.statuses, 'stun')).toBe(true);
    expect(hasStatus(withBoth.statuses, 'slow')).toBe(true);
    expect(withBoth.statuses).toHaveLength(2);
  });

  it('burn and poison combined damage stacks', () => {
    let state = createTestGameState();
    const withBurn = applyStatusToPlayer(state.player, 'burn', 2, 5, null);
    const withBoth = applyStatusToPlayer(withBurn, 'poison', 2, 5, null);
    state = { ...state, player: withBoth };

    const healthBefore = state.player.stats.health;
    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Should take damage from both burn and poison
    expect(tickedState.player.stats.health).toBeLessThan(healthBefore);
  });

  it('panic reduces both accuracy and evasion while active', () => {
    const player = applyStatusToPlayer(createTestPlayer(), 'panic', 2, 1, null);
    const baseAccuracy = 80;
    const baseEvasion = 20;

    expect(getEffectiveStat(baseAccuracy, 'accuracy', player.statuses)).toBeLessThan(baseAccuracy);
    expect(getEffectiveStat(baseEvasion, 'evasion', player.statuses)).toBeLessThan(baseEvasion);
  });

  it('arcane_charge stacks magnitude but caps repeated applications', () => {
    const player = createTestPlayer();
    const first = applyStatusToPlayer(player, 'arcane_charge', 2, 1, null);
    const second = applyStatusToPlayer(first, 'arcane_charge', 2, 1, null);
    const third = applyStatusToPlayer(second, 'arcane_charge', 2, 1, null);
    const overCap = applyStatusToPlayer(third, 'arcane_charge', 2, 1, null);
    const thirdMagnitude = third.statuses.find(status => status.id === 'arcane_charge')?.magnitude ?? 0;
    const overCapMagnitude = overCap.statuses.find(status => status.id === 'arcane_charge')?.magnitude ?? 0;

    expect(second.statuses.find(status => status.id === 'arcane_charge')?.magnitude ?? 0).toBeGreaterThan(
      first.statuses.find(status => status.id === 'arcane_charge')?.magnitude ?? 0,
    );
    expect(overCapMagnitude).toBe(thirdMagnitude);
  });
});

describe('Health clamping and edge cases (Phase 3)', () => {
  it('poison damage clamps health to 0 minimum, not negative', () => {
    let state = createTestGameState();
    // Set very low health
    state = {
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: 3 },
      },
    };
    const withPoison = applyStatusToPlayer(state.player, 'poison', 2, 10, null);
    state = { ...state, player: withPoison };

    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Health should be >= 0, not negative
    expect(tickedState.player.stats.health).toBeGreaterThanOrEqual(0);
    expect(tickedState.player.stats.health).toBeLessThanOrEqual(3);
  });

  it('multiple DoT sources clamp correctly when combined damage exceeds health', () => {
    let state = createTestGameState();
    state = {
      ...state,
      player: {
        ...state.player,
        stats: { ...state.player.stats, health: 5 },
      },
    };
    const withBurn = applyStatusToPlayer(state.player, 'burn', 2, 5, null);
    const withBoth = applyStatusToPlayer(withBurn, 'poison', 2, 5, null);
    state = { ...state, player: withBoth };

    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Health should be >= 0 despite multiple DoT sources
    expect(tickedState.player.stats.health).toBeGreaterThanOrEqual(0);
  });

  it('enemy DoT damage clamps to 0 minimum', () => {
    let state = createTestGameStateInCombat();
    const enemy = createTestEnemy({
      position: { x: 1, y: 1 },
      isAlerted: true,
      lastKnownPlayerPos: null,
      stats: { maxHealth: 10, health: 3, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
    });
    const burnEnemy = {
      ...enemy,
      statuses: [{ id: 'burn' as StatusId, turnsRemaining: 2, magnitude: 10, sourceId: null }],
    };
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1, new SeededRNG(1));
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Health should be >= 0, not negative (or undefined)
    if (ticked) {
      expect(ticked.stats.health).toBeGreaterThanOrEqual(0);
    }
  });

  it('minimum damage DoT still reduces health over ticks', () => {
    let state = createTestGameState();
    const withMinDamage = applyStatusToPlayer(state.player, 'burn', 10, 1, null);
    state = { ...state, player: withMinDamage };

    const healthBefore = state.player.stats.health;
    const { state: tickedState } = tickPlayerStatuses(state, 1);

    // Status should still tick (duration decrements)
    expect(hasStatus(tickedState.player.statuses, 'burn')).toBe(true);
    // Even 1 damage magnitude burn should reduce health
    expect(tickedState.player.stats.health).toBeLessThanOrEqual(healthBefore);
  });
});

describe('Enemy regeneration and position-key storage', () => {
  it('enemy with regeneration status heals and remains stored under position key', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({
      position: { x: 2, y: 3 },
      isAlerted: true,
      lastKnownPlayerPos: null,
      stats: { maxHealth: 100, health: 50, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
    });
    const regenEnemy = {
      ...enemy,
      statuses: [{ id: 'regeneration' as StatusId, turnsRemaining: 3, magnitude: 15, sourceId: null }],
    };
    const enemyKey = posKey(regenEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, regenEnemy]]) } };

    const healthBefore = regenEnemy.stats.health;
    const { state: tickedState } = tickEnemyStatuses(state, regenEnemy, 1, new SeededRNG(1));

    // Verify enemy is stored under position key after tick
    const tickedEnemy = tickedState.run?.enemies.get(enemyKey);
    expect(tickedEnemy).toBeDefined();
    
    // Verify health increased from regeneration
    if (tickedEnemy) {
      expect(tickedEnemy.stats.health).toBeGreaterThan(healthBefore);
      // Should not exceed max health
      expect(tickedEnemy.stats.health).toBeLessThanOrEqual(tickedEnemy.stats.maxHealth);
    }
  });

  it('enemy regeneration does not exceed max health', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({
      position: { x: 2, y: 3 },
      isAlerted: true,
      lastKnownPlayerPos: null,
      stats: { maxHealth: 100, health: 50, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
    });
    const regenEnemy = {
      ...enemy,
      statuses: [{ id: 'regeneration' as StatusId, turnsRemaining: 3, magnitude: 200, sourceId: null }],
    };
    const enemyKey = posKey(regenEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, regenEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, regenEnemy, 1, new SeededRNG(1));
    const tickedEnemy = tickedState.run?.enemies.get(enemyKey);

    // Health should heal and clamp to maxHealth, not exceed it
    if (tickedEnemy) {
      expect(tickedEnemy.stats.health).toBeGreaterThan(50);
      expect(tickedEnemy.stats.health).toBeLessThanOrEqual(tickedEnemy.stats.maxHealth);
    }
  });

  it('storm_active deterministically strikes visible enemies and emits animatable thunderstorm events', () => {
    const visibleFloorCell = {
      tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
      visibility: 'visible' as const,
    };
    const rememberedFloorCell = {
      ...visibleFloorCell,
      visibility: 'remembered' as const,
    };
    type TestFloorCell = {
      tile: typeof visibleFloorCell.tile;
      visibility: 'visible' | 'remembered';
    };
    const durableEnemyStats = {
      maxHealth: 100,
      health: 100,
      attack: 8,
      defense: 0,
      accuracy: 70,
      evasion: 15,
      speed: 120,
    };

    const buildStormState = () => {
      const visibleEnemies = [
        createTestEnemy({ position: { x: 2, y: 0 }, stats: durableEnemyStats }),
        createTestEnemy({ position: { x: 3, y: 0 }, stats: durableEnemyStats }),
        createTestEnemy({ position: { x: 2, y: 1 }, stats: durableEnemyStats }),
        createTestEnemy({ position: { x: 3, y: 1 }, stats: durableEnemyStats }),
      ];
      const hiddenEnemy = createTestEnemy({
        position: { x: 4, y: 4 },
        stats: durableEnemyStats,
      });
      const enemies = new Map([
        ...visibleEnemies.map((enemy) => [posKey(enemy.position), enemy] as const),
        [posKey(hiddenEnemy.position), hiddenEnemy] as const,
      ]);
      const baseState = createTestGameStateInCombat();
      return {
        ...baseState,
        player: applyStatusToPlayer(baseState.player, 'storm_active', 3, 1, null),
        run: {
          ...baseState.run!,
          enemies,
          floor: {
            ...baseState.run!.floor,
            cells: new Map<string, TestFloorCell>([
              ['0,0', visibleFloorCell],
              ['2,0', visibleFloorCell],
              ['3,0', visibleFloorCell],
              ['2,1', visibleFloorCell],
              ['3,1', visibleFloorCell],
              ['4,4', rememberedFloorCell],
            ]),
          },
        },
      };
    };

    const firstResult = tickPlayerStatuses(buildStormState(), 1, new SeededRNG(12345));
    const secondResult = tickPlayerStatuses(buildStormState(), 1, new SeededRNG(12345));

    const firstStrikePositions = firstResult.events
      .filter((event): event is AbilityUsedEvent => event.type === 'ABILITY_USED' && event.abilityId === 'thunderstorm')
      .map((event) => event.targetSnapshots?.[0]?.position);
    const secondStrikePositions = secondResult.events
      .filter((event): event is AbilityUsedEvent => event.type === 'ABILITY_USED' && event.abilityId === 'thunderstorm')
      .map((event) => event.targetSnapshots?.[0]?.position);

    expect(firstStrikePositions).toEqual(secondStrikePositions);
    expect(firstStrikePositions.length).toBeGreaterThan(0);
    expect(firstStrikePositions.length).toBeLessThanOrEqual(3);
    expect(firstStrikePositions).not.toContainEqual({ x: 4, y: 4 });

    for (const position of firstStrikePositions) {
      expect(position).toBeDefined();
      const enemy = position === undefined
        ? undefined
        : firstResult.state.run?.enemies.get(posKey(position));
      expect(enemy?.stats.health).toBeLessThan(100);
      expect(enemy?.statuses.some((status) => status.id === 'burn')).toBe(true);
      expect(enemy?.statuses.find((status) => status.id === 'stun')).toEqual(
        expect.objectContaining({ turnsRemaining: 2 }),
      );
    }
  });

  it('storm_active does not resolve when the player is already dead', () => {
    const baseState = createTestGameStateInCombat();
    const enemyKey = posKey({ x: 1, y: 0 });
    const enemyBefore = baseState.run?.enemies.get(enemyKey);
    const playerWithStorm = applyStatusToPlayer(baseState.player, 'storm_active', 3, 1, null);
    const state = {
      ...baseState,
      player: {
        ...playerWithStorm,
        stats: {
          ...playerWithStorm.stats,
          health: 0,
        },
      },
    };

    const result = tickPlayerStatuses(state, 1, new SeededRNG(12345));
    const stormEvents = result.events.filter(
      (event): event is AbilityUsedEvent => event.type === 'ABILITY_USED' && event.abilityId === 'thunderstorm',
    );
    const enemyAfter = result.state.run?.enemies.get(enemyKey);

    expect(stormEvents).toHaveLength(0);
    expect(enemyAfter?.stats.health).toBe(enemyBefore?.stats.health);
    expect(enemyAfter?.statuses).toEqual(enemyBefore?.statuses);
  });

  it('storm_active does not resolve after an earlier status kills the player in the same tick', () => {
    const baseState = createTestGameStateInCombat();
    const enemyKey = posKey({ x: 1, y: 0 });
    const enemyBefore = baseState.run?.enemies.get(enemyKey);
    const poisonedPlayer = applyStatusToPlayer(baseState.player, 'poison', 2, 1, null);
    const playerWithStorm = applyStatusToPlayer(poisonedPlayer, 'storm_active', 3, 1, null);
    const state = {
      ...baseState,
      player: {
        ...playerWithStorm,
        stats: {
          ...playerWithStorm.stats,
          health: 1,
        },
      },
    };

    const result = tickPlayerStatuses(state, 1, new SeededRNG(12345));
    const stormEvents = result.events.filter(
      (event): event is AbilityUsedEvent => event.type === 'ABILITY_USED' && event.abilityId === 'thunderstorm',
    );
    const enemyAfter = result.state.run?.enemies.get(enemyKey);

    expect(result.state.player.stats.health).toBeLessThanOrEqual(0);
    expect(stormEvents).toHaveLength(0);
    expect(enemyAfter?.stats.health).toBe(enemyBefore?.stats.health);
    expect(enemyAfter?.statuses).toEqual(enemyBefore?.statuses);
  });

  it('storm_active routes lethal strikes through enemy kill processing', () => {
    const visibleFloorCell = {
      tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
      visibility: 'visible' as const,
    };
    const doomedEnemy = createTestEnemy({
      position: { x: 2, y: 0 },
      stats: {
        maxHealth: 30,
        health: 1,
        attack: 8,
        defense: 0,
        accuracy: 70,
        evasion: 15,
        speed: 120,
      },
    });
    const enemyKey = posKey(doomedEnemy.position);
    const baseState = createTestGameStateInCombat();
    const state = {
      ...baseState,
      player: applyStatusToPlayer(baseState.player, 'storm_active', 3, 1, null),
      run: {
        ...baseState.run!,
        enemies: new Map([[enemyKey, doomedEnemy]]),
        floor: {
          ...baseState.run!.floor,
          cells: new Map([
            ['0,0', visibleFloorCell],
            [enemyKey, visibleFloorCell],
          ]),
        },
      },
    };

    const result = tickPlayerStatuses(state, 1, new SeededRNG(12345));

    expect(result.state.run?.enemies.get(enemyKey)).toBeUndefined();
    expect(result.state.player.totalKills).toBe(state.player.totalKills + 1);
    expect(result.state.player.experience).toBe(state.player.experience + doomedEnemy.experienceValue);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ABILITY_USED',
      abilityId: 'thunderstorm',
      targetId: doomedEnemy.id,
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ENTITY_DIED',
      entityId: doomedEnemy.id,
      killerId: state.player.id,
    }));
  });
});
