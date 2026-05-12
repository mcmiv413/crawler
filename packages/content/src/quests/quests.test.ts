import { describe, it, expect } from 'vitest';
import { QUEST_TEMPLATES } from './index.js';

describe('quest templates', () => {
  it('exports at least 3 quest templates', () => {
    expect(QUEST_TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it('each template has required fields', () => {
    for (const template of QUEST_TEMPLATES) {
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('title');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('objectiveText');
      expect(template).toHaveProperty('objective');
      expect(template).toHaveProperty('reward');
      expect(typeof template.id).toBe('string');
      expect(typeof template.title).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.objectiveText).toBe('string');
      expect(template.objectiveText).not.toBe(template.description);
      expect(template.objective).toBeDefined();
      expect(template.objective.type).toMatch(/collect_item|defeat_enemy|reach_floor/);
      expect(template.reward.type).toBe('gold');
      expect(template.reward.amount).toBeGreaterThan(0);
    }
  });

  it('each template has unique id', () => {
    const ids = new Set(QUEST_TEMPLATES.map(t => t.id));
    expect(ids.size).toBe(QUEST_TEMPLATES.length);
  });
});
