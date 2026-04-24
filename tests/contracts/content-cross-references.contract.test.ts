import { describe, it, expect } from 'vitest';
import { QUEST_TEMPLATES } from '@dungeon/content';
import { ITEM_BY_ID } from '@dungeon/content';
import { ENEMY_TEMPLATES } from '@dungeon/content';

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
    it('every quest targetItemId references an existing item', () => {
      for (const quest of QUEST_TEMPLATES) {
        if (quest.targetItemId) {
          const item = ITEM_BY_ID.get(quest.targetItemId);
          expect(
            item,
            `Quest "${quest.id}" references non-existent item "${quest.targetItemId}"`,
          ).toBeDefined();
        }
      }
    });

    it('every quest targetEnemyTemplateId references an existing enemy', () => {
      for (const quest of QUEST_TEMPLATES) {
        if (quest.targetEnemyTemplateId) {
          const exists = ENEMY_TEMPLATES.has(quest.targetEnemyTemplateId);
          expect(
            exists,
            `Quest "${quest.id}" references non-existent enemy "${quest.targetEnemyTemplateId}"`,
          ).toBe(true);
        }
      }
    });

    it('every quest has at least one target (item, enemy, or depth)', () => {
      for (const quest of QUEST_TEMPLATES) {
        const hasTarget =
          quest.targetItemId || quest.targetEnemyTemplateId || quest.targetFloorDepth;
        expect(
          hasTarget,
          `Quest "${quest.id}" has no target (missing targetItemId, targetEnemyTemplateId, or targetFloorDepth)`,
        ).toBe(true);
      }
    });
  });
});
