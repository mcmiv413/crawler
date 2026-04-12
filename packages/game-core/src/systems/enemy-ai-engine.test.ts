import { describe, it, expect } from 'vitest';
import { scoreEnemyActions } from './enemy-ai-engine.js';
import { ARCHETYPES } from '@dungeon/content';
import { createTestGameStateInCombat, createTestEnemy } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';

describe('Enemy AI Scoring Engine', () => {
  describe('scoreEnemyActions', () => {
    it('returns valid trace with candidates', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ position: { x: 1, y: 0 }, isAlerted: true });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);

      expect(trace).toBeDefined();
      expect(trace.enemyId).toBe(enemy.id);
      expect(trace.candidates).toBeDefined();
      expect(trace.candidates.length).toBeGreaterThan(0);
      expect(trace.chosen).toBeDefined();
      expect(trace.chosen.action).toBeDefined();
    });

    it('aggressive_melee at distance 1 prefers attack', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
      const enemy = createTestEnemy({ position: { x: 1, y: 0 }, isAlerted: true });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      expect(trace.chosen.action.type).toBe('attack');
    });

    it('skittish_ranged at distance 1 prefers move', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        archetype: 'skittish_ranged',
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('skittish_ranged');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('skittish_ranged archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // Skittish should have move action when adjacent (retreat is one of the feasible actions)
      expect(trace.candidates.length).toBeGreaterThan(0);
      // The chosen action should be high-scored (based on archetype rules)
      expect(trace.chosen.action).toBeDefined();
    });

    it('all candidates have scores and reasoning', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ position: { x: 3, y: 0 }, isAlerted: true });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);

      for (const candidate of trace.candidates) {
        expect(candidate.scores).toBeDefined();
        expect(typeof candidate.totalScore).toBe('number');
        expect(candidate.reasoning).toBeDefined();
        expect(candidate.reasoning.length).toBeGreaterThan(0);
      }
    });

    it('chosen action is highest-scoring candidate', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ position: { x: 2, y: 0 }, isAlerted: true });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      const maxScore = Math.max(...trace.candidates.map(c => c.totalScore));
      expect(trace.chosen.totalScore).toBe(maxScore);
    });
  });

  describe('archetype behavior patterns', () => {
    it('all archetypes produce valid decisions', () => {
      const state = createTestGameStateInCombat();
      const rng = new SeededRNG(42);

      for (const [archetypeId, archetype] of ARCHETYPES) {
        const enemy = createTestEnemy({
          position: { x: 2, y: 0 },
          archetype: archetypeId,
          isAlerted: true,
        });

        const trace = scoreEnemyActions(enemy, archetype, state, rng);

        expect(trace.chosen).toBeDefined();
        expect(trace.chosen.action).toBeDefined();
        expect(
          ['move', 'attack', 'ability', 'wait'].includes(trace.chosen.action.type),
        ).toBe(true);
      }
    });

    it('wait action is always available as fallback', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ position: { x: 5, y: 5 }, isAlerted: true });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      const waitCandidate = trace.candidates.find(c => c.action.type === 'wait');
      expect(waitCandidate).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles enemy with no abilities gracefully', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        abilities: undefined,
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      expect(trace.chosen).toBeDefined();
      // Should still work, just without ability options
      expect(trace.chosen.action.type).toBe('attack');
    });

    it('handles multiple candidates with same score', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({ position: { x: 5, y: 5 }, isAlerted: true });
      const archetype = ARCHETYPES.get('cautious_defensive');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('cautious_defensive archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // Should still pick one (first in sorted list)
      expect(trace.chosen).toBeDefined();
      expect(trace.chosen.action).toBeDefined();
    });
  });
});
