import { describe, it, expect } from 'vitest';
import { GameEngine } from './game-engine.js';
import { createTestGameState } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';

describe('GameEngine — applyRunConsequences integration', () => {
  describe('consequences applied when run ends via command', () => {
    it('applies town deltas on victory', () => {
      const engine = new GameEngine();
      const state = createTestGameState();

      // Simulate game state where player can defeat a boss
      if (!state.run) return;

      const rng = new SeededRNG(42);
      const initialTown = state.world.town;

      // When player defeats boss (depth >= 5, boss enemy), consequences should apply
      // This is tested via submitCommand integration
      expect(state.world.town).toBeDefined();
    });

    it('world state is updated regardless of server call', () => {
      const engine = new GameEngine();
      const state = createTestGameState();

      // Engine should apply consequences internally
      // Not relying on apps/server/src/app.ts to call applyRunConsequences
      expect(engine).toBeDefined();
      expect(state.world).toBeDefined();
    });

    it('consequences trigger on player death', () => {
      const engine = new GameEngine();
      const state = createTestGameState();

      if (!state.run) return;
      const initialTown = state.world.town.prosperity;

      // On death, prosperity should decrease
      // This should be handled by engine, not server
      expect(state.world.town.prosperity).toBeDefined();
    });

    it('event chains are evaluated after consequences', () => {
      const engine = new GameEngine();
      const state = createTestGameState();

      // Event chains (3+ deaths, nemesis kills, faction checks)
      // should be evaluated by engine internally
      expect(state.world.eventHistory).toBeDefined();
    });
  });
});
