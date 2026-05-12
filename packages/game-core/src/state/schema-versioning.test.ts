/**
 * Comprehensive schema versioning tests.
 * Validates that serializeState/deserializeState handle versions correctly
 * and reject incompatible saves.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeState,
  deserializeState,
} from './serialization.js';
import {
  CURRENT_SCHEMA_VERSION,
  SchemaVersionMismatchError,
  SchemaParseError,
  getSchemaVersionErrorMessage,
  validateSchemaVersion,
} from '@dungeon/contracts';
import { createTestGameState } from '../testing/index.js';

describe('Schema Versioning', () => {
  let baseState = createTestGameState();

  beforeEach(() => {
    baseState = createTestGameState();
  });

  describe('serializeState with schemaVersion', () => {
    it('should include schemaVersion in serialized output', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should include schemaVersion at the top level', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      expect('schemaVersion' in parsed).toBe(true);
    });

    it('should preserve all state fields alongside schemaVersion', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      expect(parsed.gameId).toBeDefined();
      expect(parsed.player).toBeDefined();
      expect(parsed.world).toBeDefined();
      expect(parsed.phase).toBeDefined();
    });
  });

  describe('deserializeState with schema validation', () => {
    it('should successfully deserialize state with correct schemaVersion', () => {
      const serialized = serializeState(baseState);
      const deserialized = deserializeState(serialized);
      expect(deserialized.gameId).toBe(baseState.gameId);
    });

    it('should reject state with mismatched schemaVersion', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      parsed.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
      const modified = JSON.stringify(parsed);

      expect(() => deserializeState(modified)).toThrow(SchemaVersionMismatchError);
    });

    it('should throw SchemaVersionMismatchError with correct version info', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      const invalidVersion = 99;
      parsed.schemaVersion = invalidVersion;
      const modified = JSON.stringify(parsed);

      try {
        deserializeState(modified);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaVersionMismatchError);
        if (error instanceof SchemaVersionMismatchError) {
          expect(error.foundVersion).toBe(invalidVersion);
          expect(error.expectedVersion).toBe(CURRENT_SCHEMA_VERSION);
        }
      }
    });

    it('should reject malformed JSON', () => {
      const malformed = '{not valid json}';
      expect(() => deserializeState(malformed)).toThrow(SchemaParseError);
    });

    it('should reject non-object JSON', () => {
      const nonObject = JSON.stringify('just a string');
      expect(() => deserializeState(nonObject)).toThrow(SchemaParseError);
    });

    it('should reject state missing required fields', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      delete parsed.player;
      const modified = JSON.stringify(parsed);

      expect(() => deserializeState(modified)).toThrow(SchemaParseError);
    });

    it('defaults magic ring player fields when same-version saves omit them', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      delete parsed.player.mana;
      delete parsed.player.maxMana;
      delete parsed.player.ringMastery;
      delete parsed.player.learnedRingSpellIds;
      const modified = JSON.stringify(parsed);

      const deserialized = deserializeState(modified);

      expect(deserialized.player.mana).toBeGreaterThan(0);
      expect(deserialized.player.maxMana).toBeGreaterThan(0);
      expect(deserialized.player.ringMastery).toEqual({});
      expect(deserialized.player.learnedRingSpellIds).toEqual([]);
    });
  });

  describe('validateSchemaVersion', () => {
    it('should accept valid schemaVersion', () => {
      const serialized = serializeState(baseState);
      const { schemaVersion, parsed } = validateSchemaVersion(serialized);
      expect(schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(parsed).toBeDefined();
    });

    it('should reject mismatched schemaVersion', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      parsed.schemaVersion = CURRENT_SCHEMA_VERSION + 1;
      const modified = JSON.stringify(parsed);

      expect(() => validateSchemaVersion(modified)).toThrow(SchemaVersionMismatchError);
    });

    it('should treat missing schemaVersion as v0 legacy format', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      delete parsed.schemaVersion;
      const modified = JSON.stringify(parsed);

      const { schemaVersion } = validateSchemaVersion(modified);
      expect(schemaVersion).toBe(0);
    });

    it('should reject non-integer schemaVersion', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      parsed.schemaVersion = '1'; // string instead of number
      const modified = JSON.stringify(parsed);

      expect(() => validateSchemaVersion(modified)).toThrow(SchemaParseError);
    });

    it('should reject float schemaVersion', () => {
      const serialized = serializeState(baseState);
      const parsed = JSON.parse(serialized);
      parsed.schemaVersion = 1.5;
      const modified = JSON.stringify(parsed);

      expect(() => validateSchemaVersion(modified)).toThrow(SchemaParseError);
    });
  });

  describe('getSchemaVersionErrorMessage', () => {
    it('should return message for older version', () => {
      const message = getSchemaVersionErrorMessage(0);
      expect(message).toContain('older version');
      expect(message).toContain('start a new run');
    });

    it('should return message for newer version', () => {
      const message = getSchemaVersionErrorMessage(999);
      expect(message).toContain('newer version');
      expect(message).toContain('update the game client');
    });

    it('should treat negative version as old version', () => {
      const message = getSchemaVersionErrorMessage(-1);
      expect(message).toContain('older version');
    });
  });

  describe('Round-trip serialization/deserialization', () => {
    it('should preserve state through serialization cycle', () => {
      const serialized = serializeState(baseState);
      const deserialized = deserializeState(serialized);
      const reerialized = serializeState(deserialized);
      const redes = deserializeState(reerialized);

      expect(redes.gameId).toBe(baseState.gameId);
      expect(redes.player.name).toBe(baseState.player.name);
      expect(redes.phase).toBe(baseState.phase);
    });

    it('should preserve schemaVersion through multiple cycles', () => {
      let serialized = serializeState(baseState);
      for (let i = 0; i < 3; i++) {
        const deserialized = deserializeState(serialized);
        serialized = serializeState(deserialized);
        const parsed = JSON.parse(serialized);
        expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      }
    });
  });

  describe('Error messages', () => {
    it('SchemaVersionMismatchError message includes version info', () => {
      const error = new SchemaVersionMismatchError(0, 1);
      expect(error.message).toContain('v0');
      expect(error.message).toContain('v1');
      expect(error.message).toContain('version');
    });

    it('SchemaParseError message is preserved', () => {
      const msg = 'Failed to parse save file';
      const error = new SchemaParseError(msg);
      expect(error.message).toBe(msg);
    });
  });
});
