import { describe, it, expect } from 'vitest';
import { checkWeaponMasteryUnlocks } from './weapon-mastery.js';
import { createTestGameState, createTestRunState } from '../test-utils.js';
import { EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';

function stateWithBladHits(hits: number) {
  const run = createTestRunState({ weaponMastery: { blade: hits } });
  const base = createTestGameState({ phase: 'dungeon' });
  return { ...base, run };
}

describe('checkWeaponMasteryUnlocks', () => {
  it('grants T1 ability when blade hits reach 10', () => {
    const state = stateWithBladHits(10);
    const { state: newState, events } = checkWeaponMasteryUnlocks(state, 'blade');
    expect(newState.player.abilities.some(a => a.id === 'blade_bleed')).toBe(true);
    expect(events.some(e => e.type === 'MASTERY_UNLOCKED')).toBe(true);
  });

  it('grants T2 ability when blade hits reach 25', () => {
    const state = stateWithBladHits(25);
    const { state: newState, events } = checkWeaponMasteryUnlocks(state, 'blade');
    expect(newState.player.abilities.some(a => a.id === 'blade_riposte')).toBe(true);
    const masteryEvents = events.filter(e => e.type === 'MASTERY_UNLOCKED');
    expect(masteryEvents.length).toBe(2); // both T1 and T2 unlocked
  });

  it('does not re-grant already-owned ability (idempotent)', () => {
    let state = stateWithBladHits(10);
    const first = checkWeaponMasteryUnlocks(state, 'blade');
    const second = checkWeaponMasteryUnlocks(first.state, 'blade');
    // Should not duplicate ability
    expect(second.state.player.abilities.filter(a => a.id === 'blade_bleed')).toHaveLength(1);
    expect(second.events.filter(e => e.type === 'MASTERY_UNLOCKED')).toHaveLength(0);
  });

  it('emits MASTERY_UNLOCKED event with correct tier and abilityId', () => {
    const state = stateWithBladHits(10);
    const { events } = checkWeaponMasteryUnlocks(state, 'blade');
    const evt = events.find(e => e.type === 'MASTERY_UNLOCKED') as any;
    expect(evt.tier).toBe(1);
    expect(evt.abilityId).toBe('blade_bleed');
    expect(evt.weaponType).toBe('blade');
  });

  it('does not grant bludgeon ability for blade hits', () => {
    const state = stateWithBladHits(10);
    const { state: newState } = checkWeaponMasteryUnlocks(state, 'blade');
    expect(newState.player.abilities.some(a => a.id === 'bludgeon_stagger')).toBe(false);
  });

  it('grants nothing at 9 hits (one below threshold)', () => {
    const state = stateWithBladHits(9);
    const { state: newState, events } = checkWeaponMasteryUnlocks(state, 'blade');
    expect(newState.player.abilities.some(a => a.id === 'blade_bleed')).toBe(false);
    expect(events.filter(e => e.type === 'MASTERY_UNLOCKED')).toHaveLength(0);
  });

  it('grants T1 but not T2 at exactly 10 hits', () => {
    const state = stateWithBladHits(10);
    const { state: newState } = checkWeaponMasteryUnlocks(state, 'blade');
    expect(newState.player.abilities.some(a => a.id === 'blade_bleed')).toBe(true);
    expect(newState.player.abilities.some(a => a.id === 'blade_riposte')).toBe(false);
  });

  it('grants both T1 and T2 in same call when hits jump past 25', () => {
    const state = stateWithBladHits(25);
    const { state: newState, events } = checkWeaponMasteryUnlocks(state, 'blade');
    expect(newState.player.abilities.some(a => a.id === 'blade_bleed')).toBe(true);
    expect(newState.player.abilities.some(a => a.id === 'blade_riposte')).toBe(true);
    expect(events.filter(e => e.type === 'MASTERY_UNLOCKED')).toHaveLength(2);
  });

  it('tracks mastery independently per weapon type', () => {
    const run = createTestRunState({ weaponMastery: { bludgeon: 15 } });
    const base = createTestGameState({ phase: 'dungeon' });
    const state = { ...base, run };
    const { state: newState } = checkWeaponMasteryUnlocks(state, 'bludgeon');
    expect(newState.player.abilities.some(a => a.id === 'bludgeon_stagger')).toBe(true);
    expect(newState.player.abilities.some(a => a.id === 'blade_bleed')).toBe(false);
  });
});
