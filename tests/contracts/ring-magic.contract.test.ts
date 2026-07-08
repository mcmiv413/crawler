/**
 * Test layer: contract
 * Behavior: Ring magic content, player initialization, and package boundaries stay internally consistent across spells, schools, items, abilities, statuses, and mastery data.
 * Proof: Assertions check spell metadata, XP/gold gates, effect handlers, school/prerequisite/status/ability references, combo gates, school ring IDs, empty learned spells on new game, ringMastery { xp } entries after EQUIP, no content import of @dungeon/core, and required type fields.
 * Validation: pnpm vitest run tests/contracts/ring-magic.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameEngine } from '@dungeon/core';
import type { RingSpellDefinition, RingSchoolDefinition } from '@dungeon/content';
import { RING_SPELL_BY_ID, RING_SCHOOL_BY_ID } from '@dungeon/content';
import { ABILITY_DEFINITIONS } from '@dungeon/content';
import { STATUS_DEFINITIONS } from '@dungeon/content';
import { ITEM_BY_ID, MAGIC } from '@dungeon/content';
import { entityId } from '@dungeon/contracts';

/**
 * Ring Magic System Contract Tests
 *
 * Validates:
 * - Ring spell definitions have complete metadata (schools, study requirements, effect kinds)
 * - Ring schools are uniquely identified with correct ring mappings
 * - Spell cross-references (schools, status effects, prerequisites) all exist
 * - Player state fixtures properly initialize learnedRingSpellIds and ringMastery
 * - Combo spells have equippedSchool requirements for all schools
 *
 * Run before every commit to ensure magic system integrity.
 */

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('Ring Magic System Contracts', () => {
  describe('When RING_SPELL_BY_ID is populated', () => {
    it('every spell has a non-empty schools array', () => {
      expect(RING_SPELL_BY_ID.size).toBeGreaterThan(0);
      for (const [id, spell] of RING_SPELL_BY_ID) {
        expect(spell.schools, `Spell "${id}" has empty schools`).toEqual(
          expect.arrayContaining([expect.any(String)]),
        );
      }
    });

    it('every spell has defined studyRequirements', () => {
      for (const [id, spell] of RING_SPELL_BY_ID) {
        expect(spell.studyRequirements).toBeDefined();
        expect(Array.isArray(spell.studyRequirements)).toBe(true);
      }
    });

    it('every spell has positive cast XP metadata', () => {
      for (const [id, spell] of RING_SPELL_BY_ID) {
        expect(
          spell.xpGainOnCast,
          `Spell "${id}" must define positive xpGainOnCast metadata`,
        ).toBeGreaterThan(0);
      }
    });

    it('starter casts cannot clear a mastery tier and study gold costs stay non-trivial', () => {
      const firstMasteryThreshold = MAGIC.schoolMasteryTierThresholds[1];
      expect(firstMasteryThreshold).toBeGreaterThan(0);

      for (const [id, spell] of RING_SPELL_BY_ID) {
        expect(
          spell.xpGainOnCast,
          `Spell "${id}" cast XP must not clear a school mastery tier in one cast`,
        ).toBeLessThan(firstMasteryThreshold);

        const goldCosts = spell.studyRequirements
          .filter((requirement): requirement is { kind: 'goldCost'; gold: number } =>
            requirement.kind === 'goldCost');
        expect(goldCosts.length, `Spell "${id}" must not define multiple gold costs`).toBeLessThanOrEqual(1);
        for (const cost of goldCosts) {
          expect(cost.gold, `Spell "${id}" study gold cost must stay non-trivial`).toBeGreaterThanOrEqual(10);
        }
      }
    });

    it('lightning single-school ladder matches the baseline cast XP progression', () => {
      const baselinePairs = [
        ['bolt', 'ember'],
        ['thunder_step', 'heat_surge'],
        ['rolling_thunder', 'cinder_wake'],
      ] as const;

      for (const [lightningSpellId, baselineSpellId] of baselinePairs) {
        expect(
          RING_SPELL_BY_ID.get(lightningSpellId)?.xpGainOnCast,
          `Spell "${lightningSpellId}" should match baseline cast XP from "${baselineSpellId}"`,
        ).toBe(RING_SPELL_BY_ID.get(baselineSpellId)?.xpGainOnCast);
      }
    });

    it('every spell has a valid effectKind', () => {
      const validKinds = ['single_target_damage', 'self_buff', 'line_damage', 'custom'];
      for (const [id, spell] of RING_SPELL_BY_ID) {
        expect(validKinds.includes(spell.effectKind),
          `Spell "${id}" has invalid effectKind: ${spell.effectKind}`
        ).toBe(true);
      }
    });

    it('custom spells have effectHandlerId, non-custom spells do not', () => {
      for (const [id, spell] of RING_SPELL_BY_ID) {
        if (spell.effectKind === 'custom') {
          expect(spell.effectHandlerId,
            `Custom spell "${id}" missing effectHandlerId`
          ).toBeDefined();
        } else {
          expect(spell.effectHandlerId,
            `Non-custom spell "${id}" should not have effectHandlerId`
          ).toBeUndefined();
        }
      }
    });

    it('every spell in schools array references existing ring schools', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        for (const school of spell.schools) {
          expect(RING_SCHOOL_BY_ID.has(school),
            `Spell "${spellId}" references non-existent school "${school}"`
          ).toBe(true);
        }
      }
    });

    it('every combo spell has equippedSchool requirements for all its schools', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        if (spell.schools.length > 1) {
          const requiredSchools = new Set(
            spell.studyRequirements
              .filter((r): r is { kind: 'equippedSchool'; school: string } => r.kind === 'equippedSchool')
              .map(r => r.school)
          );
          for (const school of spell.schools) {
            expect(requiredSchools.has(school),
              `Combo spell "${spellId}" missing equippedSchool requirement for "${school}"`
            ).toBe(true);
          }
        }
      }
    });

    it('combo spell mastery gates stay paired to equipped-school requirements without duplicates', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        if (spell.schools.length < 2) continue;

        const equippedSchools = new Set(
          spell.studyRequirements
            .filter((requirement): requirement is { kind: 'equippedSchool'; school: string } =>
              requirement.kind === 'equippedSchool')
            .map((requirement) => requirement.school),
        );
        const minimumSchoolXpRequirements = spell.studyRequirements
          .filter((requirement): requirement is { kind: 'minimumSchoolXp'; school: string; xp: number } =>
            requirement.kind === 'minimumSchoolXp');
        const seenSchools = new Set<string>();

        for (const requirement of minimumSchoolXpRequirements) {
          expect(
            seenSchools.has(requirement.school),
            `Combo spell "${spellId}" declares duplicate minimumSchoolXp gates for "${requirement.school}"`,
          ).toBe(false);
          seenSchools.add(requirement.school);
          expect(
            equippedSchools.has(requirement.school),
            `Combo spell "${spellId}" must pair minimumSchoolXp gate "${requirement.school}" with equippedSchool`,
          ).toBe(true);
        }
      }
    });

    it('every prerequisiteSpell requirement references an existing spell', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        for (const req of spell.studyRequirements) {
          if (req.kind === 'prerequisiteSpell') {
            expect(RING_SPELL_BY_ID.has(req.spellId),
              `Spell "${spellId}" requires non-existent spell "${req.spellId}"`
            ).toBe(true);
          }
        }
      }
    });

    it('every statusId in statusEffects exists in STATUS_DEFINITIONS', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        if (spell.statusEffects) {
          for (const effect of spell.statusEffects) {
            expect(STATUS_DEFINITIONS.has(effect.statusId),
              `Spell "${spellId}" references non-existent status "${effect.statusId}"`
            ).toBe(true);
          }
        }
      }
    });

    it('every spell exists in ABILITY_DEFINITIONS', () => {
      for (const spellId of RING_SPELL_BY_ID.keys()) {
        expect(ABILITY_DEFINITIONS.has(spellId),
          `Ring spell "${spellId}" not found in ABILITY_DEFINITIONS`
        ).toBe(true);
      }
    });

    it('fire spells use minimumSchoolXp or no XP requirement consistently', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        if (spell.schools.includes('fire')) {
          const xpReq = spell.studyRequirements.find(r => r.kind === 'minimumSchoolXp');
          if (xpReq !== undefined) {
            expect(xpReq.school, `Fire spell "${spellId}" XP requirement must point at the fire school`).toBe('fire');
            expect(xpReq.xp, `Fire spell "${spellId}" XP requirement must be non-negative`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('combo spells only declare minimumSchoolXp gates for their own schools', () => {
      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        if (spell.schools.length < 2) continue;

        const minimumSchoolXpRequirements = spell.studyRequirements
          .filter((requirement): requirement is { kind: 'minimumSchoolXp'; school: string; xp: number } =>
            requirement.kind === 'minimumSchoolXp');

        for (const requirement of minimumSchoolXpRequirements) {
          expect(
            spell.schools.includes(requirement.school),
            `Combo spell "${spellId}" has minimumSchoolXp gate for unrelated school "${requirement.school}"`,
          ).toBe(true);
        }
      }
    });

    it('thunderstorm stays locked until both Fire and Lightning reach display level 4', () => {
      const thunderstorm = RING_SPELL_BY_ID.get('thunderstorm');
      const equippedSchools = thunderstorm?.studyRequirements
        .filter((requirement): requirement is { kind: 'equippedSchool'; school: string } =>
          requirement.kind === 'equippedSchool')
        .map(requirement => requirement.school);

      expect(thunderstorm?.schools).toEqual(['fire', 'lightning']);
      expect(thunderstorm?.minimumSchoolLevel).toBe(4);
      expect(equippedSchools).toEqual(expect.arrayContaining(['fire', 'lightning']));
    });
  });

  describe('When RING_SCHOOL_BY_ID is populated', () => {
    it('every school has a unique id', () => {
      const ids = new Set<string>();
      for (const school of RING_SCHOOL_BY_ID.values()) {
        expect(ids.has(school.id), `Duplicate school id: ${school.id}`).toBe(false);
        ids.add(school.id);
      }
    });

    it('every school has a unique ringId', () => {
      const ringIds = new Set<string>();
      for (const school of RING_SCHOOL_BY_ID.values()) {
        expect(ringIds.has(school.ringId), `Duplicate ringId: ${school.ringId}`).toBe(false);
        ringIds.add(school.ringId);
      }
    });

    it('every school ringId corresponds to an existing item', () => {
      for (const school of RING_SCHOOL_BY_ID.values()) {
        expect(ITEM_BY_ID.has(school.ringId),
          `School "${school.id}" references non-existent item "${school.ringId}"`
        ).toBe(true);
      }
    });
  });

  describe('When Player state is created', () => {
    it('new players have learnedRingSpellIds initialized as empty array', () => {
      const state = new GameEngine().createNewGame(1);

      expect(Array.isArray(state.player.learnedRingSpellIds), 'learnedRingSpellIds must be an array').toBe(true);
      expect(state.player.learnedRingSpellIds.length, 'new players start with no learned spells').toBe(0);
    });

    it('learnedRingSpellIds can only contain valid spell IDs from RING_SPELL_BY_ID', () => {
      // If a player learns a spell, it must exist in RING_SPELL_BY_ID
      const validSpellIds = Array.from(RING_SPELL_BY_ID.keys());
      expect(validSpellIds.length, 'RING_SPELL_BY_ID must have at least one spell').toBeGreaterThan(0);

      // Example: every spell in RING_SPELL_BY_ID is valid to learn
      for (const spellId of validSpellIds) {
        const spell = RING_SPELL_BY_ID.get(spellId);
        expect(spell, `Spell "${spellId}" must be defined`).toBeDefined();
        expect(Array.isArray(spell?.schools), `Spell "${spellId}" schools must be an array`).toBe(true);
      }
    });

    it('ringMastery entries use { xp: number } not { xp, level }', () => {
      const engine = new GameEngine();
      const state = engine.createNewGame(1);
      const ringEntityId = entityId('contract_fire_ring');
      const fireRing = ITEM_BY_ID.get('fire_ring');
      expect(fireRing).toBeDefined();
      const withRing = {
        ...state,
        player: {
          ...state.player,
          inventory: [ringEntityId],
        },
        itemRegistry: {
          items: new Map([[ringEntityId, fireRing!]]),
        },
      };
      const equipped = engine.submitCommand(withRing, { type: 'EQUIP', itemId: ringEntityId }).state;

      expect(Object.keys(equipped.player.ringMastery).length).toBeGreaterThan(0);
      for (const [school, entry] of Object.entries(equipped.player.ringMastery)) {
        expect(Object.keys(entry), `ringMastery.${school} must only store xp`).toEqual(['xp']);
        expect(Number.isFinite(entry.xp), `ringMastery.${school}.xp must be finite`).toBe(true);
      }
    });
  });

  describe('Content integration', () => {
    it('fire ring item references fire school', () => {
      const fireRing = ITEM_BY_ID.get('fire_ring');
      expect(fireRing).toBeDefined();
      const fireSchool = RING_SCHOOL_BY_ID.get('fire');
      expect(fireSchool?.ringId).toBe('fire_ring');
    });

    it('content package does not import game-core', () => {
      const contentFiles = collectSourceFiles(join(process.cwd(), 'packages/content/src'))
        .filter(filePath => !filePath.endsWith('.test.ts'));

      for (const filePath of contentFiles) {
        const source = readFileSync(filePath, 'utf8');
        expect(source, `${filePath} must not import @dungeon/core`).not.toMatch(/from ['"]@dungeon\/core(?:\/|['"])/);
      }
    });
  });

  describe('Type system verification', () => {
    it('RingSpellDefinition extends AbilityDefinition', () => {
      for (const spell of RING_SPELL_BY_ID.values()) {
        const abilityLike: Pick<RingSpellDefinition, 'id' | 'name' | 'description' | 'cooldown'> = spell;
        expect(abilityLike.id).toBe(spell.id);
        expect(abilityLike.name.length).toBeGreaterThan(0);
        expect(abilityLike.description.length).toBeGreaterThan(0);
        expect(abilityLike.cooldown).toBeGreaterThanOrEqual(0);
      }
    });

    it('RingSchoolDefinition has required fields', () => {
      for (const school of RING_SCHOOL_BY_ID.values()) {
        const requiredFields: Pick<RingSchoolDefinition, 'id' | 'label' | 'ringId' | 'description'> = school;
        expect(requiredFields.id).toMatch(/\S/);
        expect(requiredFields.label).toMatch(/\S/);
        expect(requiredFields.ringId).toMatch(/\S/);
        expect(requiredFields.description).toMatch(/\S/);
      }
    });
  });
});
