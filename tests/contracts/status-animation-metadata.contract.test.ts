import { describe, expect, it } from 'vitest';
import { STATUS_DEFINITIONS } from '@dungeon/content';
import { PLAYER_STATUS_PRESENTATION, getStatusPresentation } from '../../packages/presenter/src/animation-metadata.js';

describe('status animation metadata contract', () => {
  it('exports animation ids directly on every ring presentation', () => {
    for (const [statusId, presentation] of Object.entries(PLAYER_STATUS_PRESENTATION)) {
      if (presentation.ring === undefined) {
        continue;
      }

      const overlayId = STATUS_DEFINITIONS.get(statusId)?.overlay?.id;
      expect(overlayId, `${statusId} overlay id`).toBeDefined();
      expect(presentation.animationId, `${statusId} direct presentation animation id`).toBe(overlayId);
      expect(getStatusPresentation(statusId)?.animationId, `${statusId} presentation animation id`).toBe(overlayId);
    }
  });
});
