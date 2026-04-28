import type { GameState, Quest, DomainEvent } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { ENEMY_TEMPLATES, ITEM_BY_ID } from '@dungeon/content';

/**
 * Evaluates if a quest's objective has been satisfied and marks it ready to turn in.
 * Returns the updated quest and any progress events.
 */
export function evaluateQuestProgress(
  quest: Quest,
  state: GameState,
): { quest: Quest; events: DomainEvent[] } {
  if (quest.status !== 'active') {
    return { quest, events: [] };
  }

  const events: DomainEvent[] = [];

  // Evaluate progress based on objective type
  const updatedQuest = updateQuestProgress(quest, state);

  // Check if objective is now satisfied
  if (isObjectiveSatisfied(updatedQuest)) {
    const readyQuest: Quest = {
      ...updatedQuest,
      status: 'ready_to_turn_in',
    };

    const event: DomainEvent = {
      type: 'QUEST_READY',
      questId: readyQuest.id,
      questTitle: readyQuest.title,
      giverNpcId: entityId(readyQuest.giverNpcId),
      message: `${readyQuest.title} is ready to turn in to ${readyQuest.giverNpcId}`,
      timestamp: Date.now(),
      turnNumber: state.turnNumber,
    };

    return { quest: readyQuest, events: [...events, event] };
  }

  // Otherwise return the updated quest with no status change
  return { quest: updatedQuest, events };
}

/**
 * Updates quest progress based on player actions and current state.
 */
function updateQuestProgress(quest: Quest, state: GameState): Quest {
  const objective = quest.objective;

  switch (objective.type) {
    case 'collect_item': {
      // Check if player has the target item
      const targetId = objective.targetId;
      if (targetId === undefined || targetId.length === 0) return quest;

      const hasItem = state.player.inventory.some(itemId => {
        const template = state.itemRegistry.items.get(itemId);
        return template?.itemId === targetId;
      });

      return {
        ...quest,
        objective: {
          ...objective,
          progress: hasItem === true ? 1 : 0,
        },
      };
    }

    case 'defeat_enemy': {
      // For now, progress is tracked externally through events.
      // This is a placeholder that would be called when enemies die.
      return quest;
    }

    case 'reach_floor': {
      // Check if player has reached the target floor depth
      const targetCount = (objective as { targetCount?: number }).targetCount;
      const targetDepth = targetCount === undefined ? 0 : targetCount;
      const playerFloor = state.player.floor;

      return {
        ...quest,
        objective: {
          ...objective,
          progress: Math.min(playerFloor, targetDepth),
        },
      };
    }

    default:
      return quest;
  }
}

/**
 * Checks if a quest's objective has been fully satisfied.
 */
function isObjectiveSatisfied(quest: Quest): boolean {
  const { objective } = quest;

  switch (objective.type) {
    case 'collect_item':
      return objective.progress >= 1;

    case 'defeat_enemy':
      return objective.progress >= (objective.targetCount ?? 1);

    case 'reach_floor':
      return objective.progress >= (objective.targetCount ?? 0);

    default:
      return false;
  }
}

/**
 * Redeems a ready quest, paying out the reward and marking it rewarded.
 */
export function redeemQuest(
  state: GameState,
  quest: Quest,
): { state: GameState; event: DomainEvent } {
  if (quest.status !== 'ready_to_turn_in') {
    throw new Error(`Cannot redeem quest in status: ${quest.status}`);
  }

  // In the current implementation, only gold rewards exist
  const rewardAmount = (quest.reward as { type: 'gold'; amount: number }).amount;

  const updatedState: GameState = {
    ...state,
    activeQuests: state.activeQuests.map(q =>
      q.id === quest.id ? { ...q, status: 'rewarded' } : q,
    ),
    player: {
      ...state.player,
      gold: state.player.gold + rewardAmount,
    },
  };

  const event: DomainEvent = {
    type: 'QUEST_TURNED_IN',
    questId: quest.id,
    questTitle: quest.title,
    rewardGold: rewardAmount,
    giverNpcId: entityId(quest.giverNpcId),
    timestamp: Date.now(),
    turnNumber: state.turnNumber,
  };

  return { state: updatedState, event };
}

/**
 * Gets a human-readable description of a quest objective.
 */
export function getObjectiveText(quest: Quest): string {
  if (typeof quest.objectiveText === 'string' && quest.objectiveText.trim().length > 0) {
    return quest.objectiveText;
  }

  const { objective } = quest;

  switch (objective.type) {
    case 'collect_item': {
      const targetId = objective.targetId;
      if (targetId === undefined || targetId.length === 0) {
        return quest.description;
      }

      const itemName = ITEM_BY_ID.get(targetId)?.name ?? humanizeObjectiveTargetId(targetId);
      const targetCount = objective.targetCount ?? 1;
      return targetCount > 1
        ? `Collect ${targetCount} copies of ${itemName}`
        : `Collect ${itemName}`;
    }

    case 'defeat_enemy': {
      const targetId = objective.targetId;
      if (targetId === undefined || targetId.length === 0) {
        return quest.description;
      }

      const enemyName = ENEMY_TEMPLATES.get(targetId)?.name ?? humanizeObjectiveTargetId(targetId);
      const targetCount = objective.targetCount ?? 1;
      return targetCount > 1
        ? `Defeat ${targetCount} ${pluralizeObjectiveTarget(enemyName)}`
        : `Defeat ${enemyName}`;
    }

    case 'reach_floor': {
      const depth = objective.targetCount ?? 0;
      return `Reach floor ${depth} in the dungeon`;
    }

    default:
      return quest.description;
  }
}

function humanizeObjectiveTargetId(targetId: string): string {
  return targetId
    .split('_')
    .filter(segment => segment.length > 0)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function pluralizeObjectiveTarget(name: string): string {
  return name.endsWith('s') ? name : `${name}s`;
}
