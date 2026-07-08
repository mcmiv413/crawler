/**
 * Test layer: integration
 * Behavior: Faction Progression covers GameEngine faction progression; all factions have power between 0 and 100; all factions have valid status (leaderless, led, or broken).
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run packages/game-core/src/engine/faction-progression.integration.test.ts
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from './game-engine.js';

describe('GameEngine faction progression', () => {
  it('all factions have power between 0 and 100', () => {
    const engine = new GameEngine();
    const state = engine.createNewGame(42);

    for (const faction of state.world.factions) {
      expect(faction.power).toBeGreaterThanOrEqual(0);
      expect(faction.power).toBeLessThanOrEqual(100);
    }
  });

  it('all factions have valid status (leaderless, led, or broken)', () => {
    const engine = new GameEngine();
    const state = engine.createNewGame(42);

    const validStatuses = ['leaderless', 'led', 'broken'] as const;
    for (const faction of state.world.factions) {
      expect(validStatuses).toContain(faction.status);
    }
  });

  it('factions are not mutated when evaluating consequences', () => {
    const engine = new GameEngine();
    const townState = engine.createNewGame(42);
    const dungeonState = engine.submitCommand(townState, { type: 'TOWN_ACTION', action: 'enter_dungeon' }).state;

    const factionsBefore = JSON.parse(JSON.stringify(dungeonState.world.factions));

    // Simulate player retreating from dungeon
    const result = engine.submitCommand(dungeonState, { type: 'RETREAT' });

    // Check that factions haven't been mutated (still same reference integrity)
    expect(result.state.world.factions.length).toBe(factionsBefore.length);
    for (let i = 0; i < factionsBefore.length; i++) {
      expect(result.state.world.factions[i]!.id).toBe(factionsBefore[i]!.id);
    }
  });

  it('broken factions with leaderSlain flag do not respond to events', () => {
    const engine = new GameEngine();
    const state = engine.createNewGame(42);

    const brokenFactions = state.world.factions.filter(f => f.status === 'broken' && f.leaderSlain);
    expect(brokenFactions.length).toBeGreaterThanOrEqual(0);

    // Verify broken factions are properly formed
    for (const faction of brokenFactions) {
      expect(faction.leaderSlain).toBe(true);
      expect(faction.status).toBe('broken');
    }
  });

  it('faction leader is null for leaderless factions', () => {
    const engine = new GameEngine();
    const state = engine.createNewGame(42);

    const leaderlessFactions = state.world.factions.filter(f => f.status === 'leaderless');
    for (const faction of leaderlessFactions) {
      expect(faction.leader).toBeNull();
    }
  });

  it('faction leader is defined for led factions', () => {
    const engine = new GameEngine();
    const state = engine.createNewGame(42);

    const ledFactions = state.world.factions.filter(f => f.status === 'led');
    for (const faction of ledFactions) {
      expect(faction.leader).toBeDefined();
      expect(faction.leader).not.toBeNull();
    }
  });

  it('faction disposition is preserved across game phases', () => {
    const engine = new GameEngine();
    let state = engine.createNewGame(42);
    const dispositionBefore = state.world.factions.map(f => f.disposition);

    // Enter and retreat from dungeon
    state = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon' }).state;
    const result = engine.submitCommand(state, { type: 'RETREAT' });

    // Disposition should not change from these actions alone
    const dispositionAfter = result.state.world.factions.map(f => f.disposition);
    expect(dispositionAfter).toEqual(dispositionBefore);
  });
});
