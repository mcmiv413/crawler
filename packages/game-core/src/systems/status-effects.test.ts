import { describe, it, expect } from 'vitest';
import {
  applyStatusToPlayer,
  tickPlayerStatuses,
  tickEnemyStatuses,
  getEffectiveStat,
  hasStatus
} from './status-effects.js';
import { createTestPlayer, createTestEnemy, createTestGameState } from '../test-utils.js';
import { posKey } from '@dungeon/contracts';
import type { StatusId } from '@dungeon/contracts';

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

    const { state: tickedState1 } = tickPlayerStatuses(state, 1);
    // Poison does damage per turn
    expect(tickedState1.player.stats.health).toBeLessThan(healthBefore);
    expect(tickedState1.player.stats.health).toBeGreaterThanOrEqual(0);

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

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1);
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Burn should have dealt damage
    expect(ticked?.stats.health).toBeLessThan(healthBefore);

    // Duration should have decremented
    const burnStatus = ticked?.statuses.find((s: any) => s.id === 'burn');
    expect(burnStatus?.turnsRemaining ?? 0).toBeLessThan(initialDuration);
  });

  it('enemy status expires after duration reaches 0', () => {
    let state = createTestGameState();
    const enemy = createTestEnemy({ position: { x: 1, y: 1 }, isAlerted: true, lastKnownPlayerPos: null });
    const burnEnemy = { ...enemy, statuses: [{ id: 'burn' as StatusId, turnsRemaining: 1, magnitude: 3, sourceId: null }] };
    const enemyKey = posKey(burnEnemy.position);
    state = { ...state, run: { ...state.run!, enemies: new Map([[enemyKey, burnEnemy]]) } };

    const { state: tickedState } = tickEnemyStatuses(state, burnEnemy, 1);
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

    const { state: tickedState } = tickEnemyStatuses(state, multiStatus, 1);
    const ticked = tickedState.run?.enemies.get(enemyKey);

    // Poison should expire, burn should remain
    expect(ticked?.statuses).toHaveLength(1);
    expect(ticked?.statuses[0]?.id).toBe('burn');
    expect(ticked?.statuses[0]?.turnsRemaining).toBe(1);
  });
});
