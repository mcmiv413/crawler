import { describe, it, expect } from 'vitest';
import { processTalkNpc, updateNpcDisposition } from './npc.js';
import { createTestGameState } from '../test-utils.js';
import { entityId } from '@dungeon/contracts';
import type { NpcState } from '@dungeon/contracts';

const informant: NpcState = {
  id: entityId('npc_informant'),
  name: 'Scratch',
  role: 'informant',
  disposition: 30,
  available: true,
  dialogueKey: 'informant',
};

const shopkeeper: NpcState = {
  id: entityId('npc_shopkeeper'),
  name: 'Torben',
  role: 'shopkeeper',
  disposition: 50,
  available: true,
  dialogueKey: 'shopkeeper',
};

describe('processTalkNpc', () => {
  it('informant assigns a quest on first conversation', () => {
    const state = createTestGameState({ world: { npcs: [informant] } });

    const { state: newState } = processTalkNpc(state, informant.id);

    expect(newState.activeQuests).toHaveLength(1);
    expect(newState.activeQuests[0]!.status).toBe('active');
    expect(newState.activeQuests[0]!.giverNpcId).toBe(informant.id);
  });

  it('informant does not assign duplicate quest on second talk', () => {
    const state = createTestGameState({ world: { npcs: [informant] } });

    const { state: s1 } = processTalkNpc(state, informant.id);
    const { state: s2 } = processTalkNpc(s1, informant.id);

    expect(s2.activeQuests).toHaveLength(1);
  });

  it('increases informant disposition on first talk', () => {
    const state = createTestGameState({ world: { npcs: [informant] } });

    const { state: newState } = processTalkNpc(state, informant.id);

    const npc = newState.world.npcs.find(n => n.id === informant.id)!;
    expect(npc.disposition).toBeGreaterThan(informant.disposition);
  });

  it('non-informant NPC increases disposition on talk', () => {
    const state = createTestGameState({ world: { npcs: [shopkeeper] } });

    const { state: newState } = processTalkNpc(state, shopkeeper.id);

    const npc = newState.world.npcs.find(n => n.id === shopkeeper.id)!;
    expect(npc.disposition).toBeGreaterThan(shopkeeper.disposition);
  });

  it('non-informant NPC does not assign quests', () => {
    const state = createTestGameState({ world: { npcs: [shopkeeper] } });

    const { state: newState } = processTalkNpc(state, shopkeeper.id);

    expect(newState.activeQuests).toHaveLength(0);
  });

  it('returns unchanged state for unknown NPC id', () => {
    const state = createTestGameState({ world: { npcs: [informant] } });

    const { state: newState } = processTalkNpc(state, entityId('no_such_npc'));

    expect(newState.activeQuests).toHaveLength(0);
    expect(newState.world.npcs[0]!.disposition).toBe(informant.disposition);
  });

  it('disposition is capped at 100', () => {
    const maxNpc: NpcState = { ...informant, disposition: 99 };
    const state = createTestGameState({ world: { npcs: [maxNpc] } });

    const { state: newState } = processTalkNpc(state, maxNpc.id);

    const npc = newState.world.npcs.find(n => n.id === maxNpc.id)!;
    expect(npc.disposition).toBeLessThanOrEqual(100);
  });

  it('informant with disposition < 20 does not assign quest', () => {
    const coldInformant: NpcState = { ...informant, disposition: 10 };
    const state = createTestGameState({ world: { npcs: [coldInformant] } });
    const { state: newState } = processTalkNpc(state, coldInformant.id);
    expect(newState.activeQuests).toHaveLength(0);
  });

  it('informant with disposition < 20 still gets small disposition bump', () => {
    const coldInformant: NpcState = { ...informant, disposition: 10 };
    const state = createTestGameState({ world: { npcs: [coldInformant] } });
    const { state: newState } = processTalkNpc(state, coldInformant.id);
    const npc = newState.world.npcs.find(n => n.id === coldInformant.id)!;
    expect(npc.disposition).toBe(12); // +2 bump
  });

  it('informant with disposition >= 20 assigns quest normally', () => {
    const warmInformant: NpcState = { ...informant, disposition: 20 };
    const state = createTestGameState({ world: { npcs: [warmInformant] } });
    const { state: newState } = processTalkNpc(state, warmInformant.id);
    expect(newState.activeQuests).toHaveLength(1);
  });
});

describe('updateNpcDisposition', () => {
  it('increases disposition by delta', () => {
    const npcs = [informant];
    const updated = updateNpcDisposition(npcs, informant.id, 10);
    const npc = updated.find(n => n.id === informant.id)!;
    expect(npc.disposition).toBe(40);
  });

  it('decreases disposition by delta', () => {
    const npcs = [informant];
    const updated = updateNpcDisposition(npcs, informant.id, -5);
    const npc = updated.find(n => n.id === informant.id)!;
    expect(npc.disposition).toBe(25);
  });

  it('clamps disposition at 100', () => {
    const maxNpc: NpcState = { ...informant, disposition: 95 };
    const npcs = [maxNpc];
    const updated = updateNpcDisposition(npcs, maxNpc.id, 10);
    const npc = updated.find(n => n.id === maxNpc.id)!;
    expect(npc.disposition).toBe(100);
  });

  it('clamps disposition at 0', () => {
    const minNpc: NpcState = { ...informant, disposition: 5 };
    const npcs = [minNpc];
    const updated = updateNpcDisposition(npcs, minNpc.id, -10);
    const npc = updated.find(n => n.id === minNpc.id)!;
    expect(npc.disposition).toBe(0);
  });

  it('does not modify other NPCs', () => {
    const npc1 = informant;
    const npc2 = shopkeeper;
    const npcs = [npc1, npc2];
    const updated = updateNpcDisposition(npcs, npc1.id, 10);
    const unchanged = updated.find(n => n.id === npc2.id)!;
    expect(unchanged.disposition).toBe(npc2.disposition);
  });
});
