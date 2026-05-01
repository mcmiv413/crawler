import type { GameState, EntityId, NpcState } from '@dungeon/contracts';
import type { DomainEvent } from '@dungeon/contracts';
import { createQuestFromTemplate, selectRandomQuestTemplate } from '@dungeon/content';
import type { SeededRNG } from '../utils/rng.js';
import { SeededRNG as SeededRNGImpl } from '../utils/rng.js';

/**
 * Updates an NPC's disposition by a delta amount (clamped to 0-100).
 * Returns a new NPC array with the updated disposition.
 */
export function updateNpcDisposition(
  npcs: readonly NpcState[],
  npcId: EntityId,
  delta: number,
): NpcState[] {
  return npcs.map(n =>
    n.id === npcId ? { ...n, disposition: Math.min(100, Math.max(0, n.disposition + delta)) } : n,
  );
}

export function processTalkNpc(
  state: GameState,
  npcId?: EntityId,
  rng?: SeededRNG,
): { state: GameState; events: DomainEvent[] } {
  if (npcId === undefined) return { state, events: [] };

  const npc = state.world.npcs.find(n => n.id === npcId);
  if (npc === undefined) return { state, events: [] };

  const events: DomainEvent[] = [];

  // Informant: assign a retrieve quest on first conversation if disposition is high enough
  if (npc.role === 'informant') {
    // Check if player already has an active or ready quest (one-quest-at-a-time limit)
    const hasActiveOrReadyQuest = state.activeQuests.some(
      q => q.status === 'active' || q.status === 'ready_to_turn_in',
    );
    if (hasActiveOrReadyQuest === true) {
      // Player must complete or fail existing quest first
      return {
        state: {
          ...state,
          world: {
            ...state.world,
            npcs: updateNpcDisposition(state.world.npcs, npcId, 1),
          },
        },
        events,
      };
    }

    // Check if player already has a quest from this specific informant
    const hasQuestFromThisGiver = state.activeQuests.some(
      q => q.giverNpcId === npcId && q.status === 'active',
    );
    if (hasQuestFromThisGiver === false) {
      // Disposition too low — informant won't share information yet
      if (npc.disposition < 20) {
        return {
          state: {
            ...state,
            world: {
              ...state.world,
              npcs: updateNpcDisposition(state.world.npcs, npcId, 2),
            },
          },
          events,
        };
      }

      // D3: Select a random quest template using RNG for non-deterministic variety
      // If rng not provided, create a seed-based RNG from turn number (fallback for tests)
      const rngSource = rng ?? new SeededRNGImpl(state.turnNumber);
      const template = selectRandomQuestTemplate(() => rngSource.next());
      const quest = createQuestFromTemplate(template, npcId, state.turnNumber);
      const newState: GameState = {
        ...state,
        activeQuests: [...state.activeQuests, quest],
        world: {
          ...state.world,
          npcs: updateNpcDisposition(state.world.npcs, npcId, 5),
        },
      };
      return {
        state: newState,
        events: [...events, {
          type: 'QUEST_ASSIGNED',
          questId: quest.id,
          questTitle: quest.title,
          questDescription: quest.description,
          rewardGold: quest.reward.amount,
          giverNpcId: npcId,
          timestamp: state.turnNumber,
          turnNumber: state.turnNumber,
        }],
      };
    }
  }

  // Small disposition bump for talking
  const newState: GameState = {
    ...state,
    world: {
      ...state.world,
      npcs: updateNpcDisposition(state.world.npcs, npcId, 2),
    },
  };

  return { state: newState, events };
}
