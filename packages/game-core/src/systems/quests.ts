import type { DomainEvent, GameState } from '@dungeon/contracts';

export function completeQuest(
  state: GameState,
  quest: GameState['activeQuests'][number],
): { state: GameState; event: DomainEvent } {
  const updatedState = {
    ...state,
    activeQuests: state.activeQuests.map(q =>
      q.id === quest.id ? { ...q, status: 'complete' as const } : q,
    ),
    player: { ...state.player, gold: state.player.gold + quest.rewardGold },
  };

  const event: DomainEvent = {
    type: 'QUEST_COMPLETED',
    questId: quest.id,
    questTitle: quest.title,
    rewardGold: quest.rewardGold,
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  };

  return { state: updatedState, event };
}

export function completeFloorDepthQuests(
  state: GameState,
  newDepth: number,
): { state: GameState; events: DomainEvent[] } {
  const matchingQuests = state.activeQuests.filter(
    quest => quest.status === 'active' && quest.targetFloorDepth === newDepth,
  );

  let currentState = state;
  let events: DomainEvent[] = [];

  for (const quest of matchingQuests) {
    const result = completeQuest(currentState, quest);
    currentState = result.state;
    events = [...events, result.event];
  }

  return { state: currentState, events };
}
