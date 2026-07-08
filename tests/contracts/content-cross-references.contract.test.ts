/**
 * Test layer: contract
 * Behavior: Live quest, animation, status, and ring-magic content references resolve to the catalogs required by their contracts.
 * Proof: Expectations check quest objective targetIds and targetCounts against item/enemy/depth rules, ability and consumable animation ids in ANIMATION_REF_BY_ID, exhaustive STATUS_DEFINITIONS keys and fields, Fire Ring wiring to the fire school without grant-ability enchantments, ring spell ability and school references, and required magic status ids.
 * Validation: pnpm vitest run tests/contracts/content-cross-references.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { QUEST_TEMPLATES } from '@dungeon/content';
import { ITEM_BY_ID } from '@dungeon/content';
import { ENEMY_TEMPLATES } from '@dungeon/content';
import { ABILITY_DEFINITIONS, ANIMATION_REF_BY_ID } from '@dungeon/content';
import { ENCHANTMENT_BY_ID, RING_SCHOOL_BY_ID, RING_SPELL_BY_ID, STATUS_DEFINITIONS } from '@dungeon/content';
import type { StatusId } from '@dungeon/contracts';

/**
 * Content Cross-Reference Contract Tests
 *
 * Ensures all content IDs referenced in features actually exist in the content system.
 * This catches issues where quest templates reference non-existent items or enemies.
 *
 * Run before every commit to prevent shipping incomplete features.
 */

const CONTRACT_STATUS_IDS = [
  'poison',
  'burn',
  'slow',
  'stun',
  'bleed',
  'weaken',
  'vulnerability',
  'regeneration',
  'strength',
  'panic',
  'heat_surge',
  'arcane_charge',
  'storm_active',
] as const satisfies readonly StatusId[];

type MissingStatusIds = Exclude<StatusId, (typeof CONTRACT_STATUS_IDS)[number]>;
type ExtraStatusIds = Exclude<(typeof CONTRACT_STATUS_IDS)[number], StatusId>;

const statusIdListIsExhaustive: [MissingStatusIds, ExtraStatusIds] extends [never, never]
  ? true
  : never = true;

describe('Content Cross-References', () => {
  describe('Quest Templates', () => {
    it('every collect_item objective targetId references an existing item', () => {
      for (const quest of QUEST_TEMPLATES) {
        if (quest.objective.type === 'collect_item') {
          const targetId = quest.objective.targetId;
          expect(
            typeof targetId,
            `Quest "${quest.id}" collect_item objective is missing targetId`,
          ).toBe('string');

          expect(
            ITEM_BY_ID.has(targetId ?? ''),
            `Quest "${quest.id}" references non-existent item "${targetId}"`,
          ).toBe(true);
        }
      }
    });

    it('every defeat_enemy objective targetId references an existing enemy', () => {
      for (const quest of QUEST_TEMPLATES) {
        if (quest.objective.type === 'defeat_enemy') {
          const targetId = quest.objective.targetId;
          expect(
            targetId,
            `Quest "${quest.id}" defeat_enemy objective is missing targetId`,
          ).toBeDefined();

          const exists = ENEMY_TEMPLATES.has(targetId ?? '');
          expect(
            exists,
            `Quest "${quest.id}" references non-existent enemy "${targetId}"`,
          ).toBe(true);
        }
      }
    });

    it('every reach_floor objective targetCount is a reachable depth target', () => {
      for (const quest of QUEST_TEMPLATES) {
        if (quest.objective.type !== 'reach_floor') continue;

        expect(
          quest.objective.targetCount,
          `Quest "${quest.id}" reach_floor objective is missing targetCount`,
        ).toBeDefined();
        expect(Number.isInteger(quest.objective.targetCount)).toBe(true);
        expect(quest.objective.targetCount ?? 0).toBeGreaterThan(0);
        expect(
          quest.objective.targetId,
          `Quest "${quest.id}" reach_floor objective should not use targetId`,
        ).toBeUndefined();
      }
    });

    it('every quest objective has the required target fields for its type', () => {
      for (const quest of QUEST_TEMPLATES) {
        expect(
          ['collect_item', 'defeat_enemy', 'reach_floor'],
          `Quest "${quest.id}" has unsupported objective type "${quest.objective.type}"`,
        ).toContain(quest.objective.type);
        expect(
          quest.objective.progress,
          `Quest "${quest.id}" objective progress should start at zero in templates`,
        ).toBe(0);

        if (quest.objective.type === 'collect_item' || quest.objective.type === 'defeat_enemy') {
          expect(
            quest.objective.targetId,
            `Quest "${quest.id}" ${quest.objective.type} objective is missing targetId`,
          ).toBeDefined();
          expect(
            quest.objective.targetCount,
            `Quest "${quest.id}" ${quest.objective.type} objective is missing targetCount`,
          ).toBeDefined();
          expect(quest.objective.targetCount ?? 0).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Animations', () => {
    it('every ability has a valid animation ID that exists in ANIMATION_REF_BY_ID', () => {
      for (const [abilityId, ability] of ABILITY_DEFINITIONS) {
        expect(
          ability.animation,
          `Ability "${abilityId}" is missing animation property`,
        ).toEqual(expect.objectContaining({ id: expect.any(String) }));

        const animationId = ability.animation.id;
        expect(
          typeof animationId,
          `Ability "${abilityId}" animation is missing id`,
        ).toBe('string');

        expect(
          ANIMATION_REF_BY_ID.has(animationId),
          `Ability "${abilityId}" references non-existent animation ID "${animationId}"`,
        ).toBe(true);
      }
    });

    it('every consumable item has a valid animation ID that exists in ANIMATION_REF_BY_ID', () => {
      for (const [itemId, item] of ITEM_BY_ID) {
        if (item.itemClass !== 'consumable') continue;

        expect(
          (item as any).animation,
          `Consumable "${itemId}" is missing animation property`,
        ).toEqual(expect.objectContaining({ id: expect.any(String) }));

        const animationId = (item as any).animation.id;
        expect(
          typeof animationId,
          `Consumable "${itemId}" animation is missing id`,
        ).toBe('string');

        expect(
          ANIMATION_REF_BY_ID.has(animationId),
          `Consumable "${itemId}" references non-existent animation ID "${animationId}"`,
        ).toBe(true);
      }
    });
  });

  describe('Status Catalog', () => {
    it('tracks every contracted StatusId in this guardrail', () => {
      expect(statusIdListIsExhaustive).toBe(true);
    });

    it('has one generated catalog entry for every contracted StatusId', () => {
      expect(new Set(STATUS_DEFINITIONS.keys())).toEqual(new Set(CONTRACT_STATUS_IDS));
    });

    it('keeps each status definition aligned with its catalog key', () => {
      for (const statusId of CONTRACT_STATUS_IDS) {
        const definition = STATUS_DEFINITIONS.get(statusId);

        expect(definition, `Missing status definition for "${statusId}"`).toBeDefined();
        expect(definition?.id).toBe(statusId);
        expect(definition?.name.length).toBeGreaterThan(0);
        expect(definition?.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Magic Ring Content', () => {
    it('Fire Ring exists and is wired to the fire school without grant-ability enchantments', () => {
      const fireRing = ITEM_BY_ID.get('fire_ring');
      expect(fireRing, 'Fire Ring item is missing').toBeDefined();
      expect(fireRing?.itemClass).toBe('armor');
      if (fireRing?.itemClass !== 'armor') return;

      const fireSchool = RING_SCHOOL_BY_ID.get('fire');
      expect(fireSchool?.ringId).toBe('fire_ring');

      const grantEnchantments = fireRing.armor.enchantments
        .filter((enchantmentId): enchantmentId is string => enchantmentId !== null)
        .map(enchantmentId => ENCHANTMENT_BY_ID.get(enchantmentId))
        .filter(enchantment => enchantment?.effect.type === 'grant_ability');

      expect(grantEnchantments).toHaveLength(0);
    });

    it('Ring spell IDs reference existing abilities across all magic schools', () => {
      expect(RING_SPELL_BY_ID.size).toBeGreaterThan(0);

      for (const [spellId, spell] of RING_SPELL_BY_ID) {
        expect(
          ABILITY_DEFINITIONS.has(spellId),
          `Ring spell "${spellId}" is missing from ability catalog`,
        ).toBe(true);
        expect(
          Array.isArray(spell.schools),
          `Ring spell "${spellId}" must have schools array`,
        ).toBe(true);
        expect(
          spell.schools.length,
          `Ring spell "${spellId}" must have at least one school`,
        ).toBeGreaterThan(0);
        for (const school of spell.schools) {
          expect(
            RING_SCHOOL_BY_ID.has(school),
            `Ring spell "${spellId}" references non-existent ring school "${school}"`,
          ).toBe(true);
        }
      }
    });

    it('magic statuses exist for ring spell effects', () => {
      for (const statusId of ['burn', 'panic', 'heat_surge', 'arcane_charge', 'stun', 'storm_active']) {
        expect(
          STATUS_DEFINITIONS.has(statusId),
          `Magic status "${statusId}" is missing from status catalog`,
        ).toBe(true);
      }
    });
  });
});
