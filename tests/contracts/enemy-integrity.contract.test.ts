/**
 * Test layer: contract
 * Behavior: Enemy Integrity covers Enemy Content Integrity; Sprite uniqueness; no two enemies share the same sprite name.
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/enemy-integrity.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ENEMY_TEMPLATES, ENEMIES_BY_BIOME, BIOMES, FACTIONS } from '@dungeon/content';

/**
 * Contract Tests: Enemy Content Integrity
 *
 * Validates cross-references and structural invariants across the live enemy
 * catalog. Uses @dungeon/content public exports to avoid intra-package
 * circular import risks.
 *
 * Migrated from packages/content/src/enemies/content-integrity.test.ts
 * because these tests operate on live content data and cross-reference
 * multiple content modules — the definition of a contract test.
 */

describe('Enemy Content Integrity', () => {
  describe('Sprite uniqueness', () => {
    it('no two enemies share the same sprite name', () => {
      const seen = new Map<string, string>();
      for (const t of ENEMY_TEMPLATES.values()) {
        if (!t.spriteName) continue;
        const existing = seen.get(t.spriteName);
        expect(
          existing,
          `${t.templateId} and ${existing} share spriteName '${t.spriteName}'`,
        ).toBeUndefined();
        seen.set(t.spriteName, t.templateId);
      }
    });
  });

  describe('ASCII character uniqueness', () => {
    it('no two enemies share the same ascii character', () => {
      const seen = new Map<string, string>();
      for (const t of ENEMY_TEMPLATES.values()) {
        const existing = seen.get(t.ascii);
        expect(
          existing,
          `${t.templateId} and ${existing} both use ascii '${t.ascii}'`,
        ).toBeUndefined();
        seen.set(t.ascii, t.templateId);
      }
    });
  });

  describe('Faction membership', () => {
    it('every enemy belongs to at least one faction unless intentionally unaffiliated', () => {
      for (const t of ENEMY_TEMPLATES.values()) {
        const factions = t.factions ?? [];
        if (t.templateId === 'dungeon_ogre') {
          expect(factions).toHaveLength(0);
          continue;
        }
        expect(factions.length, `${t.templateId} has no faction membership`).toBeGreaterThan(0);
      }
    });

    it('all faction references are valid', () => {
      for (const t of ENEMY_TEMPLATES.values()) {
        const factions = t.factions ?? [];
        for (const { factionId } of factions) {
          expect(
            FACTIONS.has(factionId),
            `${t.templateId} references unknown faction '${factionId}'`,
          ).toBe(true);
        }
      }
    });

    it('every faction leader template exists and belongs to its faction', () => {
      for (const faction of FACTIONS.values()) {
        const leaderTemplate = ENEMY_TEMPLATES.get(faction.leader.templateId);
        expect(
          leaderTemplate,
          `${faction.id} leader template '${faction.leader.templateId}' is missing`,
        ).toBeDefined();
        expect(
          leaderTemplate?.factions?.some(({ factionId }) => factionId === faction.id),
          `${faction.leader.templateId} must reference faction '${faction.id}'`,
        ).toBe(true);
      }
    });

    it('faction weights are in range (0, 1]', () => {
      for (const t of ENEMY_TEMPLATES.values()) {
        const factions = t.factions ?? [];
        for (const { factionId, weight } of factions) {
          expect(
            weight,
            `${t.templateId}/${factionId} weight must be > 0`,
          ).toBeGreaterThan(0);
          expect(
            weight,
            `${t.templateId}/${factionId} weight must be <= 1`,
          ).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Biome membership', () => {
    it('every enemy belongs to at least one biome', () => {
      for (const t of ENEMY_TEMPLATES.values()) {
        const biomes = t.biomes ?? [];
        expect(
          biomes,
          `${t.templateId} belongs to no biome and can never spawn`,
        ).toEqual(expect.arrayContaining([
          expect.objectContaining({ biomeId: expect.any(String) }),
        ]));
      }
    });

    it('all biome references are valid', () => {
      for (const t of ENEMY_TEMPLATES.values()) {
        const biomes = t.biomes ?? [];
        for (const { biomeId } of biomes) {
          expect(
            BIOMES.has(biomeId),
            `${t.templateId} references unknown biome '${biomeId}'`,
          ).toBe(true);
        }
      }
    });
  });

  describe('Biome tier coverage', () => {
    it('early biomes have at least one tier-1 enemy for new players', () => {
      const earlyBiomes = Array.from(BIOMES.values()).filter(b => b.floorRange.min <= 2);
      for (const biome of earlyBiomes) {
        const enemies = ENEMIES_BY_BIOME.get(biome.biomeId) ?? [];
        const hasTier1 = enemies.some(t => t.tier === 1);
        expect(
          hasTier1,
          `early biome '${biome.biomeId}' (floors ${biome.floorRange.min}-${biome.floorRange.max}) has no tier-1 enemies`,
        ).toBe(true);
      }
    });
  });

  describe('Spawn weight', () => {
    it('regular enemies have positive spawn weight; bosses have non-negative weight', () => {
      for (const t of ENEMY_TEMPLATES.values()) {
        if (t.archetype === 'boss') {
          expect(
            t.spawn.weight,
            `${t.templateId} must not have a negative spawn weight`,
          ).toBeGreaterThanOrEqual(0);
          continue;
        }
        expect(t.spawn.weight, `${t.templateId} has zero spawn weight`).toBeGreaterThan(0);
      }
    });
  });

  describe('Sprite coverage', () => {
    it('every enemy has a spriteName defined', () => {
      const missing = Array.from(ENEMY_TEMPLATES.values())
        .filter(t => !t.spriteName)
        .map(t => t.templateId);
      expect(missing, `enemies missing spriteName: ${missing.join(', ')}`).toHaveLength(0);
    });
  });
});
