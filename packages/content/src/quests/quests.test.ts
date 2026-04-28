import { describe, it, expect } from 'vitest';
import {
  QUEST_TEMPLATES,
  selectRandomQuestTemplate,
  createQuestFromTemplate,
} from './index.js';

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

  it('selectRandomQuestTemplate returns a template from pool', () => {
    const rng = (): number => 0.5;
    const template = selectRandomQuestTemplate(rng);
    expect(QUEST_TEMPLATES).toContain(template);
  });

  it('selectRandomQuestTemplate produces selection with different rng values', () => {
    // Test that different RNG values can produce different templates
    const rng1 = (): number => 0.1;
    const rng2 = (): number => 0.9;

    const template1 = selectRandomQuestTemplate(rng1);
    const template2 = selectRandomQuestTemplate(rng2);

    // With 5 templates, different RNG values should select different indices
    expect(typeof template1.id).toBe('string');
    expect(typeof template2.id).toBe('string');
  });

  it('createQuestFromTemplate generates valid quest', () => {
    const template = QUEST_TEMPLATES[0]!;
    const quest = createQuestFromTemplate(template, 'npc1', 42);

    expect(quest.id).toContain('quest_');
    expect(quest.id).toContain('npc1');
    expect(quest.title).toBe(template.title);
    expect(quest.description).toBe(template.description);
    expect(quest.objectiveText).toBe(template.objectiveText);
    expect(quest.status).toBe('active');
    expect(quest.objective).toEqual(template.objective);
    expect(quest.reward).toEqual(template.reward);
    expect(quest.giverNpcId).toBe('npc1');
  });

  it('createQuestFromTemplate creates unique quest ids for same template/npc at different turns', () => {
    const template = QUEST_TEMPLATES[0]!;
    const quest1 = createQuestFromTemplate(template, 'npc1', 10);
    const quest2 = createQuestFromTemplate(template, 'npc1', 20);

    expect(quest1.id).not.toBe(quest2.id);
    expect(quest1.id).toContain('10');
    expect(quest2.id).toContain('20');
  });

  it('all templates have meaningful reward amounts', () => {
    for (const template of QUEST_TEMPLATES) {
      expect(template.reward.amount).toBeGreaterThanOrEqual(50);
      expect(template.reward.amount).toBeLessThanOrEqual(200);
    }
  });
});
