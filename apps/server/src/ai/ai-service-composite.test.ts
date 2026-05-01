import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeAiService } from './ai-service-composite.js';

vi.mock('./lm-studio-client.js', () => ({
  queryLmStudio: vi.fn(),
}));

vi.mock('./fallback-ai.js', () => ({
  FallbackAiService: vi.fn().mockImplementation(() => ({
    generateDialogue: vi.fn().mockResolvedValue('fallback dialogue'),
    generateRumor: vi.fn().mockResolvedValue('fallback rumor'),
    generateRunSummary: vi.fn().mockResolvedValue('fallback summary'),
  })),
}));

import { queryLmStudio } from './lm-studio-client.js';

const mockQuery = vi.mocked(queryLmStudio);

const townState = { prosperity: 50, fear: 20, corruption: 10, supplyLevel: 50, rumors: [], lastRunSummary: null };

const npcCtx = {
   
  npc: { id: 'npc1' as any, name: 'Elder', role: 'elder' as const, available: true, lastDialogue: null, disposition: 0, dialogueKey: 'default' },
  townState,
  recentEvents: [],
  playerName: 'Hero',
  playerLevel: 1,
};

const rumorCtx = {
  townState,
  deepestFloor: 3,
  totalRuns: 1,
  recentEvents: [],
};

const summaryCtx = {
  runMetrics: { causeOfEnd: 'retreat' as const, enemiesKilled: 5, goldEarned: 100, floorsCleared: 2, damageDealt: 200, damageTaken: 50, turnsElapsed: 30, consecutiveMisses: 0, itemsUsed: 0 },
  recentEvents: [],
  playerName: 'Hero',
  floor: 3,
};

describe('CompositeAiService — fallback on queryLmStudio throw', () => {
  let service: CompositeAiService;

  beforeEach(() => {
    service = new CompositeAiService();
  });

  it('generateDialogue uses fallback when queryLmStudio throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('network error'));
    const result = await service.generateDialogue(npcCtx);
    expect(result).toBe('fallback dialogue');
  });

  it('generateDialogue returns LM text when available', async () => {
    mockQuery.mockResolvedValueOnce({ text: 'Greetings, adventurer!' });
    const result = await service.generateDialogue(npcCtx);
    expect(result).toBe('Greetings, adventurer!');
  });

  it('generateDialogue uses fallback when queryLmStudio returns null text', async () => {
    mockQuery.mockResolvedValueOnce({ text: null });
    const result = await service.generateDialogue(npcCtx);
    expect(result).toBe('fallback dialogue');
  });

  it('generateRumor uses fallback when queryLmStudio throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DNS failure'));
    const result = await service.generateRumor(rumorCtx);
    expect(result).toBe('fallback rumor');
  });

  it('generateRunSummary uses fallback when queryLmStudio throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('timeout'));
    const result = await service.generateRunSummary(summaryCtx);
    expect(result).toBe('fallback summary');
  });

});
