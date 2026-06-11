import { describe, expect, it } from 'vitest';
import { ENEMY_TEMPLATES, FACTION_DEFINITIONS, INITIAL_FACTIONS } from '@dungeon/content';

describe('Faction Definitions Contract', () => {
  it('all faction IDs in INITIAL_FACTIONS have entries in FACTION_DEFINITIONS', () => {
    for (const faction of INITIAL_FACTIONS) {
      const definition = FACTION_DEFINITIONS.get(faction.id);
      expect(definition).toBeDefined();
      expect(definition?.id).toBe(faction.id);
    }
  });

  it('all faction definitions have non-empty leader name and title pools', () => {
    for (const [factionId, definition] of FACTION_DEFINITIONS) {
      expect(definition.leader).toBeDefined();
      expect(Array.isArray(definition.leader.names)).toBe(true);
      expect(definition.leader.names.length).toBeGreaterThan(0);
      expect(Array.isArray(definition.leader.titles)).toBe(true);
      expect(definition.leader.titles.length).toBeGreaterThan(0);
    }
  });

  it('all faction leader template IDs exist in ENEMY_TEMPLATES', () => {
    for (const [factionId, definition] of FACTION_DEFINITIONS) {
      const template = ENEMY_TEMPLATES.get(definition.leader.templateId);
      expect(template).toBeDefined();
      expect(template?.templateId).toBe(definition.leader.templateId);
    }
  });

  it('all enemy faction references point at existing faction definitions', () => {
    for (const [templateId, template] of ENEMY_TEMPLATES) {
      for (const factionRef of template.factions ?? []) {
        expect(
          FACTION_DEFINITIONS.has(factionRef.factionId),
          `Enemy template "${templateId}" references missing faction "${factionRef.factionId}"`,
        ).toBe(true);
      }
    }
  });

  it('each faction definition has at least one enemy member template', () => {
    for (const [factionId] of FACTION_DEFINITIONS) {
      const member = Array.from(ENEMY_TEMPLATES.values())
        .find(template => template.factions?.some(faction => faction.factionId === factionId) === true);

      expect(member, `Faction "${factionId}" must have at least one enemy member template`).toBeDefined();
    }
  });

  it('faction definitions have valid power configuration', () => {
    for (const [factionId, definition] of FACTION_DEFINITIONS) {
      expect(definition.initialPower).toBeGreaterThanOrEqual(0);
      expect(definition.initialPower).toBeLessThanOrEqual(100);
      expect(definition.initialDisposition).toBeDefined();
    }
  });
});
