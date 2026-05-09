import { describe, it, expect } from 'vitest';
import { QUEST_TEMPLATES } from '@dungeon/content';
import { ITEM_BY_ID } from '@dungeon/content';
import { ENEMY_TEMPLATES } from '@dungeon/content';
import { ABILITY_DEFINITIONS, ANIMATION_REF_BY_ID } from '@dungeon/content';

/**
 * Content Cross-Reference Contract Tests
 *
 * Ensures all content IDs referenced in features actually exist in the content system.
 * This catches issues where quest templates reference non-existent items or enemies.
 *
 * Run before every commit to prevent shipping incomplete features.
 */

describe('Content Cross-References', () => {
  describe('Quest Templates', () => {
    it('every collect_item objective targetId references an existing item', () => {
      for (const quest of QUEST_TEMPLATES) {
        if (quest.objective.type === 'collect_item') {
          const targetId = quest.objective.targetId;
          expect(
            targetId,
            `Quest "${quest.id}" collect_item objective is missing targetId`,
          ).toBeDefined();

          const item = ITEM_BY_ID.get(targetId ?? '');
          expect(
            item,
            `Quest "${quest.id}" references non-existent item "${targetId}"`,
          ).toBeDefined();
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
        ).toBeDefined();

        const animationId = ability.animation.id;
        expect(
          animationId,
          `Ability "${abilityId}" animation is missing id`,
        ).toBeDefined();

        const animRef = ANIMATION_REF_BY_ID.get(animationId);
        expect(
          animRef,
          `Ability "${abilityId}" references non-existent animation ID "${animationId}"`,
        ).toBeDefined();
      }
    });

    it('every consumable item has a valid animation ID that exists in ANIMATION_REF_BY_ID', () => {
      for (const [itemId, item] of ITEM_BY_ID) {
        if (item.itemClass !== 'consumable') continue;

        expect(
          (item as any).animation,
          `Consumable "${itemId}" is missing animation property`,
        ).toBeDefined();

        const animationId = (item as any).animation.id;
        expect(
          animationId,
          `Consumable "${itemId}" animation is missing id`,
        ).toBeDefined();

        const animRef = ANIMATION_REF_BY_ID.get(animationId);
        expect(
          animRef,
          `Consumable "${itemId}" references non-existent animation ID "${animationId}"`,
        ).toBeDefined();
      }
    });
  });
});
