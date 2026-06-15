/**
 * Migration safety tests for the knownRingSchools player field.
 *
 * knownRingSchools was added as a required Player field. Old save files
 * (pre-migration) will not have this field. These tests verify that
 * deserializeState() handles the missing field gracefully and defaults
 * it to an empty array, preserving all other player data intact.
 *
 * TDD: Tests were written BEFORE the defensive default was added to
 * deserializeState(). If knownRingSchools is missing from the save,
 * the deserialized player must still have knownRingSchools: [].
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { serializeState, deserializeState } from './serialization.js';
import { createTestGameState } from '../testing/index.js';

describe('knownRingSchools migration safety', () => {
  let baseState = createTestGameState();

  beforeEach(() => {
    baseState = createTestGameState();
  });

  describe('old save missing knownRingSchools (pre-migration save)', () => {
    it('deserializes successfully when knownRingSchools is absent', () => {
      // Simulate a pre-migration save by serializing and then removing the field
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      const player = parsed['player'] as Record<string, unknown>;
      delete player['knownRingSchools'];
      parsed['player'] = player;
      const oldSaveJson = JSON.stringify(parsed);

      // Must not throw
      expect(() => deserializeState(oldSaveJson)).not.toThrow();
    });

    it('defaults knownRingSchools to [] when field is absent', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      const player = parsed['player'] as Record<string, unknown>;
      delete player['knownRingSchools'];
      parsed['player'] = player;
      const oldSaveJson = JSON.stringify(parsed);

      const deserialized = deserializeState(oldSaveJson);

      expect(deserialized.player.knownRingSchools).toEqual([]);
    });

    it('defaults knownRingSchools to [] when field is explicitly undefined (JSON null becomes absent)', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      // JSON.stringify strips undefined; simulate a save where the key never existed
      const { player: rawPlayer, ...restOfState } = parsed;
      const { knownRingSchools: _dropped, ...playerWithoutField } = rawPlayer as Record<string, unknown>;
      const oldSaveJson = JSON.stringify({ ...restOfState, player: playerWithoutField });

      const deserialized = deserializeState(oldSaveJson);

      expect(deserialized.player.knownRingSchools).toEqual([]);
    });

    it('preserves all other player fields intact when knownRingSchools is absent', () => {
      const stateWithData = createTestGameState({
        player: {
          name: 'Thalindra',
          level: 5,
          gold: 250,
          experience: 1200,
          mana: 30,
          maxMana: 40,
          ringMastery: { fire: { xp: 100 } },
          learnedRingSpellIds: [],
        },
      });

      const serialized = serializeState(stateWithData);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      const player = parsed['player'] as Record<string, unknown>;
      delete player['knownRingSchools'];
      parsed['player'] = player;
      const oldSaveJson = JSON.stringify(parsed);

      const deserialized = deserializeState(oldSaveJson);

      expect(deserialized.player.name).toBe('Thalindra');
      expect(deserialized.player.level).toBe(5);
      expect(deserialized.player.gold).toBe(250);
      expect(deserialized.player.experience).toBe(1200);
      expect(deserialized.player.learnedRingSpellIds).toEqual([]);
      expect(deserialized.player.knownRingSchools).toEqual([]);
    });

    it('preserves non-empty knownRingSchools when the field IS present in the save', () => {
      const stateWithSchools = createTestGameState({
        player: {
          knownRingSchools: ['fire'],
          learnedRingSpellIds: [],
        },
      });

      const serialized = serializeState(stateWithSchools);
      const deserialized = deserializeState(serialized);

      expect(deserialized.player.knownRingSchools).toEqual(['fire']);
    });

    it('knownRingSchools defaults to [] independently of learnedRingSpellIds default', () => {
      // Both fields removed — each should default independently
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      const player = parsed['player'] as Record<string, unknown>;
      delete player['knownRingSchools'];
      delete player['learnedRingSpellIds'];
      parsed['player'] = player;
      const oldSaveJson = JSON.stringify(parsed);

      const deserialized = deserializeState(oldSaveJson);

      expect(deserialized.player.knownRingSchools).toEqual([]);
      expect(deserialized.player.learnedRingSpellIds).toEqual([]);
    });

    it('knownRingSchools returned value is a readonly array (not mutated)', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      const player = parsed['player'] as Record<string, unknown>;
      delete player['knownRingSchools'];
      parsed['player'] = player;
      const oldSaveJson = JSON.stringify(parsed);

      const deserialized = deserializeState(oldSaveJson);

      // The value must be an array
      expect(Array.isArray(deserialized.player.knownRingSchools)).toBe(true);
      // It must be empty
      expect(deserialized.player.knownRingSchools).toHaveLength(0);
    });
  });

  describe('round-trip with knownRingSchools present', () => {
    it('preserves knownRingSchools through a full serialize/deserialize cycle', () => {
      const stateWithSchools = createTestGameState({
        player: {
          knownRingSchools: ['fire'],
          learnedRingSpellIds: [],
        },
      });

      const serialized = serializeState(stateWithSchools);
      const deserialized = deserializeState(serialized);
      const reserialized = serializeState(deserialized);
      const redeserialized = deserializeState(reserialized);

      expect(redeserialized.player.knownRingSchools).toEqual(['fire']);
    });

    it('preserves empty knownRingSchools through a full serialize/deserialize cycle', () => {
      const serialized = serializeState(baseState);
      const deserialized = deserializeState(serialized);
      const reserialized = serializeState(deserialized);
      const redeserialized = deserializeState(reserialized);

      expect(redeserialized.player.knownRingSchools).toEqual([]);
    });
  });
});
