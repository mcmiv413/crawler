import { describe, it, expect } from 'vitest';
import type { QuestTemplate } from '@dungeon/content';
import { selectFromTemplates } from './quest-selection.js';

const LOCAL_TEMPLATES: QuestTemplate[] = [
  {
    id: 'test_quest_1',
    title: 'First Quest',
    description: 'Description 1',
    objectiveText: 'Objective 1',
    objective: { type: 'reach_floor', targetCount: 5, progress: 0 },
    reward: { type: 'gold', amount: 100 },
  },
  {
    id: 'test_quest_2',
    title: 'Second Quest',
    description: 'Description 2',
    objectiveText: 'Objective 2',
    objective: { type: 'reach_floor', targetCount: 10, progress: 0 },
    reward: { type: 'gold', amount: 200 },
  },
  {
    id: 'test_quest_3',
    title: 'Third Quest',
    description: 'Description 3',
    objectiveText: 'Objective 3',
    objective: { type: 'reach_floor', targetCount: 15, progress: 0 },
    reward: { type: 'gold', amount: 300 },
  },
];

describe('selectFromTemplates — RNG behavior with local fixtures', () => {
  it('returns a template from the provided templates array', () => {
    const template = selectFromTemplates(LOCAL_TEMPLATES, () => 0.5);
    expect(LOCAL_TEMPLATES).toContain(template);
  });

  it('accepts different rng values and returns valid templates', () => {
    const template1 = selectFromTemplates(LOCAL_TEMPLATES, () => 0.1);
    const template2 = selectFromTemplates(LOCAL_TEMPLATES, () => 0.9);

    expect(typeof template1.id).toBe('string');
    expect(typeof template2.id).toBe('string');
    expect(LOCAL_TEMPLATES).toContain(template1);
    expect(LOCAL_TEMPLATES).toContain(template2);
  });

  it('handles edge case where rng returns 0', () => {
    const template = selectFromTemplates(LOCAL_TEMPLATES, () => 0);
    expect(LOCAL_TEMPLATES).toContain(template);
    expect(template.id).toBe('test_quest_1');
  });

  it('handles edge case where rng returns 1', () => {
    const template = selectFromTemplates(LOCAL_TEMPLATES, () => 1);
    expect(LOCAL_TEMPLATES).toContain(template);
  });
});
