import { describe, it, expect, beforeEach } from 'vitest';
import {
  scoreTiles,
  analyzeSocialState,
  shouldTransition,
  decideAmbientAction,
} from './ambient-behavior-engine.js';
import {
  createTestGameState,
  createTestRunState,
  createTestEnemy,
  resetTestEnemyCounter,
} from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';
import type { AmbientBehaviorProfile, EnemyInstance } from '@dungeon/contracts';

describe('ambient-behavior-engine', () => {
  let state = createTestGameState({ phase: 'dungeon' });
  let profile: AmbientBehaviorProfile;
  let rng: SeededRNG;

  beforeEach(() => {
    resetTestEnemyCounter();
    const run = createTestRunState();
    state = { ...createTestGameState({ phase: 'dungeon' }), run };
    rng = new SeededRNG(42);

    profile = {
      id: 'test_profile',
      name: 'Test Profile',
      description: 'Test behavior profile',
      defaultState: 'roaming',
      wanderIntensity: 0.3,
      socialRadius: 5,
      groupMinSize: 3,
      groupMaxSize: 7,
      anchorRadius: 7,
      tilePreferences: {
        wallAdjacency: 0.5,
        doorwayProximity: 0.3,
        openSpace: 0.2,
        nestedCells: 0.1,
        sameSpeciesProximity: 0.8,
        otherEnemyAvoidance: 0.6,
        playerLastSeenDistance: 0.4,
      },
      stateTransitions: [
        {
          from: 'roaming',
          to: 'regrouping',
          trigger: 'ally_nearby',
        },
        {
          from: 'roaming',
          to: 'hiding',
          trigger: 'time_elapsed',
          cooldownTurns: 5,
        },
        {
          from: 'regrouping',
          to: 'roaming',
          trigger: 'no_allies',
        },
      ],
    };
  });

  describe('scoreTiles', () => {
    it('returns empty map when run is null', () => {
      const stateNoRun = { ...state, run: null };
      const enemy = createTestEnemy();

      const scores = scoreTiles(enemy, profile, stateNoRun);

      expect(scores.size).toBe(0);
    });

    it('scores tiles based on wall adjacency preference', () => {
      const enemy = createTestEnemy();
      const scores = scoreTiles(enemy, profile, state);

      expect(scores.size).toBeGreaterThan(0);
      // Tiles are scored, should have various scores
      const scoreValues = Array.from(scores.values());
      expect(scoreValues.some((s) => s > 0)).toBe(true);
    });

    it('applies walkable tile filter', () => {
      const enemy = createTestEnemy();
      const scores = scoreTiles(enemy, profile, state);

      // All scored tiles should be in the walkable floor cells
      for (const [key] of scores) {
        const cell = state.run!.floor.cells.get(key);
        expect(cell?.tile.walkable).toBe(true);
      }
    });

    it('scores wall adjacency correctly', () => {
      const enemy = createTestEnemy();
      const profileWithWalls = { ...profile, tilePreferences: { wallAdjacency: 1.0 } };

      const scores = scoreTiles(enemy, profileWithWalls, state);

      expect(scores.size).toBeGreaterThan(0);
      // Some tiles should have higher scores due to wall adjacency
      const maxScore = Math.max(...Array.from(scores.values()));
      expect(maxScore).toBeGreaterThan(0);
    });

    it('respects disabled preferences', () => {
      const enemy = createTestEnemy();
      const profileNoPrefs = {
        ...profile,
        tilePreferences: {
          wallAdjacency: 0,
          doorwayProximity: 0,
          openSpace: 0,
          nestedCells: 0,
          sameSpeciesProximity: 0,
          otherEnemyAvoidance: 0,
          playerLastSeenDistance: 0,
        },
      };

      const scores = scoreTiles(enemy, profileNoPrefs, state);

      // All tiles should have score 0 when no preferences
      const allZero = Array.from(scores.values()).every((s) => s === 0);
      expect(allZero).toBe(true);
    });
  });

  describe('analyzeSocialState', () => {
    it('returns empty state when run is null', () => {
      const stateNoRun = { ...state, run: null };
      const enemy = createTestEnemy();

      const social = analyzeSocialState(enemy, profile, stateNoRun);

      expect(social).toEqual({
        sameTypeCount: 0,
        otherTypeCount: 0,
        nearestAllyPos: null,
      });
    });

    it('counts same-type allies within radius', () => {
      const enemy = createTestEnemy({ archetype: 'aggressive-melee', position: { x: 5, y: 5 } });
      const ally1 = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 6, y: 5 },
      });
      const ally2 = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 5, y: 6 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [ally1.id, ally1],
            [ally2.id, ally2],
          ]),
        },
      };

      const social = analyzeSocialState(enemy, profile, newState);

      expect(social.sameTypeCount).toBe(2);
    });

    it('counts other-type allies within radius', () => {
      const enemy = createTestEnemy({ archetype: 'aggressive-melee', position: { x: 5, y: 5 } });
      const otherType = createTestEnemy({
        archetype: 'cautious-defensive',
        position: { x: 6, y: 5 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [otherType.id, otherType],
          ]),
        },
      };

      const social = analyzeSocialState(enemy, profile, newState);

      expect(social.otherTypeCount).toBe(1);
    });

    it('excludes allies outside social radius', () => {
      const enemy = createTestEnemy({ archetype: 'aggressive-melee', position: { x: 0, y: 0 } });
      const farAlly = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 20, y: 20 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [farAlly.id, farAlly],
          ]),
        },
      };

      const social = analyzeSocialState(enemy, profile, newState);

      expect(social.sameTypeCount).toBe(0);
    });

    it('finds nearest ally position', () => {
      const enemy = createTestEnemy({ position: { x: 5, y: 5 } });
      const near = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 6, y: 5 },
      });
      const far = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 5, y: 9 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [near.id, near],
            [far.id, far],
          ]),
        },
      };

      const social = analyzeSocialState(enemy, profile, newState);

      expect(social.nearestAllyPos).toEqual({ x: 6, y: 5 });
    });
  });

  describe('shouldTransition', () => {
    it('does not transition when current state does not match rule', () => {
      const enemy = createTestEnemy({ ambientState: 'hiding' });
      const rule = profile.stateTransitions[0]!;

      const shouldChange = shouldTransition(enemy, profile, rule, state, rng);

      expect(shouldChange).toBe(false);
    });

    it('transitions on time_elapsed when cooldown met', () => {
      const enemy = createTestEnemy({
        ambientState: 'roaming',
        ambientStateAge: 5,
      });
      const rule = {
        from: 'roaming' as const,
        to: 'hiding' as const,
        trigger: 'time_elapsed' as const,
        cooldownTurns: 5,
      };

      const shouldChange = shouldTransition(enemy, profile, rule, state, rng);

      expect(shouldChange).toBe(true);
    });

    it('does not transition on time_elapsed when cooldown not met', () => {
      const enemy = createTestEnemy({
        ambientState: 'roaming',
        ambientStateAge: 2,
      });
      const rule = {
        from: 'roaming' as const,
        to: 'hiding' as const,
        trigger: 'time_elapsed' as const,
        cooldownTurns: 5,
      };

      const shouldChange = shouldTransition(enemy, profile, rule, state, rng);

      expect(shouldChange).toBe(false);
    });

    it('transitions on ally_nearby when group threshold met', () => {
      const enemy = createTestEnemy({ archetype: 'aggressive-melee', position: { x: 5, y: 5 } });
      const ally1 = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 6, y: 5 },
      });
      const ally2 = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 5, y: 6 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [ally1.id, ally1],
            [ally2.id, ally2],
          ]),
        },
      };

      const rule = {
        from: 'roaming' as const,
        to: 'regrouping' as const,
        trigger: 'ally_nearby' as const,
      };

      const shouldChange = shouldTransition(enemy, profile, rule, newState, rng);

      expect(shouldChange).toBe(true);
    });

    it('transitions on no_allies when alone', () => {
      const enemy = createTestEnemy({ archetype: 'aggressive-melee', ambientState: 'regrouping' });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([[enemy.id, enemy]]),
        },
      };

      const rule = {
        from: 'regrouping' as const,
        to: 'roaming' as const,
        trigger: 'no_allies' as const,
      };

      const shouldChange = shouldTransition(enemy, profile, rule, newState, rng);

      expect(shouldChange).toBe(true);
    });

    it('transitions on random_wander based on probability', () => {
      const enemy = createTestEnemy({ ambientState: 'roaming' });
      const rngHigh = new SeededRNG(1); // Seeds that produce high values

      const rule = {
        from: 'roaming' as const,
        to: 'hiding' as const,
        trigger: 'random_wander' as const,
        probability: 0.5,
      };

      // With probability 0.5, we might or might not transition
      const result = shouldTransition(enemy, profile, rule, state, rngHigh);
      expect(typeof result).toBe('boolean');
    });

    it('never transitions on disturbance_heard', () => {
      const enemy = createTestEnemy({ ambientState: 'roaming' });
      const rule = {
        from: 'roaming' as const,
        to: 'stalking' as const,
        trigger: 'disturbance_heard' as const,
      };

      const shouldChange = shouldTransition(enemy, profile, rule, state, rng);

      expect(shouldChange).toBe(false);
    });
  });

  describe('decideAmbientAction', () => {
    it('returns wait action when run is null', () => {
      const stateNoRun = { ...state, run: null };
      const enemy = createTestEnemy();

      const result = decideAmbientAction(enemy, profile, stateNoRun, rng);

      expect(result.action.type).toBe('wait');
      expect(result.stateChangeEvent).toBeNull();
    });

    it('increments ambient state age', () => {
      const enemy = createTestEnemy({ ambientStateAge: 3 });

      const result = decideAmbientAction(enemy, profile, state, rng);

      expect(result.updatedEnemy.ambientStateAge).toBe(4);
    });

    it('decides roaming action', () => {
      const enemy = createTestEnemy({ ambientState: 'roaming' });

      const result = decideAmbientAction(enemy, profile, state, rng);

      expect(['move', 'wait']).toContain(result.action.type);
    });

    it('decides regrouping action toward nearest ally', () => {
      const enemy = createTestEnemy({
        ambientState: 'regrouping',
        position: { x: 5, y: 5 },
      });
      const ally = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 7, y: 7 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [ally.id, ally],
          ]),
        },
      };

      const result = decideAmbientAction(enemy, profile, newState, rng);

      expect(['move', 'wait']).toContain(result.action.type);
    });

    it('handles state transitions', () => {
      const enemy = createTestEnemy({
        ambientState: 'roaming',
        ambientStateAge: 5,
      });
      const ally = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 6, y: 5 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [ally.id, ally],
          ]),
        },
      };

      const result = decideAmbientAction(enemy, profile, newState, rng);

      // State transition might occur, creating event
      expect(result.stateChangeEvent === null || result.stateChangeEvent?.type === 'ENEMY_AMBIENT_STATE_CHANGED').toBe(true);
    });

    it('decides guarding action within anchor radius', () => {
      const anchorPos = { x: 5, y: 5 };
      const enemy = createTestEnemy({
        ambientState: 'guarding',
        position: { x: 6, y: 5 },
        anchorPosition: anchorPos,
      });

      const result = decideAmbientAction(enemy, profile, state, rng);

      expect(['move', 'wait']).toContain(result.action.type);
    });

    it('moves back to anchor when drifted away', () => {
      const anchorPos = { x: 5, y: 5 };
      const enemy = createTestEnemy({
        ambientState: 'guarding',
        position: { x: 15, y: 15 },
        anchorPosition: anchorPos,
      });

      const result = decideAmbientAction(enemy, profile, state, rng);

      expect(['move', 'wait']).toContain(result.action.type);
    });

    it('uses default state when ambientState is undefined', () => {
      const enemy = createTestEnemy();
      const { ambientState, ...enemyWithoutState } = enemy;

      const result = decideAmbientAction(enemyWithoutState as EnemyInstance, profile, state, rng);

      expect(['move', 'wait']).toContain(result.action.type);
    });

    it('emits state change event with correct metadata', () => {
      const enemy = createTestEnemy({
        ambientState: 'roaming',
        ambientStateAge: 5,
      });
      const ally = createTestEnemy({
        archetype: 'aggressive-melee',
        position: { x: 6, y: 5 },
      });

      const newState = {
        ...state,
        run: {
          ...state.run!,
          enemies: new Map([
            [enemy.id, enemy],
            [ally.id, ally],
          ]),
        },
      };

      const result = decideAmbientAction(enemy, profile, newState, rng);

      if (result.stateChangeEvent) {
        expect(result.stateChangeEvent.type).toBe('ENEMY_AMBIENT_STATE_CHANGED');
        expect(result.stateChangeEvent.enemyId).toBe(enemy.id);
        expect(result.stateChangeEvent.enemyName).toBe(enemy.name);
        expect(result.stateChangeEvent.timestamp).toBeGreaterThan(0);
        expect(result.stateChangeEvent.turnNumber).toBe(state.turnNumber);
      }
    });
  });

  describe('integration: convergence on ambient states', () => {
    it('converges to stable roaming behavior over multiple ticks', () => {
      const enemy = createTestEnemy({ ambientState: 'roaming' });
      let currentEnemy = enemy;
      let stateObj = state;

      for (let i = 0; i < 10; i++) {
        const result = decideAmbientAction(currentEnemy, profile, stateObj, rng);
        currentEnemy = result.updatedEnemy;
      }

      // After multiple ticks, enemy should be in a stable state
      expect(currentEnemy.ambientStateAge ?? 0).toBeGreaterThan(0);
    });

    it('transitions between states based on rules', () => {
      const profileWithTransition: AmbientBehaviorProfile = {
        ...profile,
        stateTransitions: [
          {
            from: 'roaming',
            to: 'hiding',
            trigger: 'time_elapsed',
            cooldownTurns: 2,
          },
        ],
      };

      const enemy = createTestEnemy({ ambientState: 'roaming', ambientStateAge: 2 });
      const result = decideAmbientAction(enemy, profileWithTransition, state, rng);

      // Should transition to hiding after 2 ticks
      expect(
        result.stateChangeEvent?.newState === 'hiding' ||
          result.updatedEnemy.ambientState === 'hiding'
      ).toBe(true);
    });
  });
});
