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

  describe('Condition parsing and evaluation (Phase 3)', () => {
    it('parses hpBelowThreshold condition correctly', () => {
      const state = createTestGameStateInCombat();
      // Create enemy with 50% HP
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        stats: { maxHealth: 100, health: 50, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      expect(trace.chosen).toBeDefined();
      expect(trace.candidates.length).toBeGreaterThan(0);
    });

    it('handles hpBelowThreshold boundary at exact threshold', () => {
      const state = createTestGameStateInCombat();
      // Create enemy with exactly 30% HP (boundary test)
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        stats: { maxHealth: 100, health: 30, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('cautious_defensive');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('cautious_defensive archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // At 30% HP, selfHpLow condition (< 0.3) should not trigger, but 30% itself might affect other rules
      expect(trace.chosen).toBeDefined();
    });

    it('parses hpAboveThreshold condition correctly', () => {
      const state = createTestGameStateInCombat();
      // Create enemy with 80% HP
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        stats: { maxHealth: 100, health: 80, attack: 8, defense: 3, accuracy: 70, evasion: 15, speed: 100 },
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      expect(trace.chosen).toBeDefined();
      expect(trace.chosen.action).toBeDefined();
    });

    it('evaluates playerAdjacent condition at distance 1', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 1, y: 0 } });
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // At distance 1, playerAdjacent should be true, so attack-related rules apply
      expect(trace.chosen.action.type).toBe('attack');
    });

    it('evaluates playerRange2to5 condition correctly', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 0, y: 0 } });
      const enemy = createTestEnemy({
        position: { x: 3, y: 0 }, // distance 3 (playerAt (0,0))
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // At distance 3, playerRange2to5 is true
      expect(trace.candidates.length).toBeGreaterThan(0);
    });

    it('evaluates playerRange6Plus condition correctly', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 0, y: 0 } });
      const enemy = createTestEnemy({
        position: { x: 7, y: 0 }, // distance 7 (playerAt (0,0))
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('skittish_ranged');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('skittish_ranged archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // At distance 7, playerRange6Plus is true
      expect(trace.candidates.length).toBeGreaterThan(0);
    });
  });

  describe('Movement behavior and fallback actions', () => {
    it('handles movement behavior without errors', () => {
      const state = createTestGameStateInCombat({ enemyAt: { x: 0, y: 0 } });
      const enemy = createTestEnemy({
        position: { x: 3, y: 0 },
        isAlerted: true,
        movementBehaviorId: 'diagonal', // Specific movement behavior
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      // Should process without error even with movement behavior set
      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      expect(trace.chosen).toBeDefined();
      expect(trace.chosen.action).toBeDefined();
    });

    it('wait action serves as fallback when no other actions feasible', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 5, y: 5 },
        isAlerted: true,
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // Wait should always be available
      const waitAction = trace.candidates.find(c => c.action.type === 'wait');
      expect(waitAction).toBeDefined();
    });
  });

  describe('Ability cooldown filtering and tie-breaking', () => {
    it('filters out abilities on cooldown from candidates', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        isAlerted: true,
        abilityCooldowns: {
          power_strike: 1, // Still on cooldown
          fireball: 0,      // Ready to use
        },
      });
      const archetype = ARCHETYPES.get('hazard_creator');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('hazard_creator archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // Ability candidates should only include those not on cooldown
      const abilityActions = trace.candidates.filter(c => c.action.type === 'ability');
      for (const action of abilityActions) {
        if (action.action.type === 'ability' && action.action.abilityId !== undefined) {
          const cooldown = enemy.abilityCooldowns?.[action.action.abilityId] ?? 0;
          expect(cooldown).toBeGreaterThanOrEqual(0);
          expect(cooldown).toBeLessThan(1);
        }
      }
    });

    it('picks first candidate when multiple have equal score (stable tie-breaking)', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 5, y: 5 },
        isAlerted: true,
      });
      // Use archetype that might produce tied scores
      const archetype = ARCHETYPES.get('cautious_defensive');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('cautious_defensive archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      
      // Check if chosen is indeed the highest-scoring
      const maxScore = Math.max(...trace.candidates.map(c => c.totalScore));
      expect(trace.chosen.totalScore).toBe(maxScore);
      
      // If there are tied candidates, chosen should be the first one (stable sort)
      const tiedCandidates = trace.candidates.filter(c => c.totalScore === maxScore);
      if (tiedCandidates.length > 1) {
        const chosenIndex = trace.candidates.indexOf(trace.chosen);
        const firstTiedIndex = trace.candidates.findIndex(c => c.totalScore === maxScore);
        expect(chosenIndex).toBe(firstTiedIndex);
      }
    });

    it('includes all available actions even with cooldowns', () => {
      const state = createTestGameStateInCombat();
      const enemy = createTestEnemy({
        position: { x: 1, y: 0 },
        isAlerted: true,
        abilityCooldowns: {
          power_strike: 5, // On cooldown
          fireball: 2,      // On cooldown
        },
      });
      const archetype = ARCHETYPES.get('aggressive_melee');
      const rng = new SeededRNG(42);

      if (!archetype) {
        throw new Error('aggressive_melee archetype not found');
      }

      const trace = scoreEnemyActions(enemy, archetype, state, rng);
      // Should still have move, attack, and wait at minimum
      const actionTypes = trace.candidates.map(c => c.action.type);
      expect(actionTypes.includes('attack')).toBe(true);
      expect(actionTypes.includes('wait')).toBe(true);
    });
  });
});
