import type { DomainEvent, EntityId } from '@dungeon/contracts';
import type { AbilityContext } from '../types.js';

interface AbilityExecutionResult {
  damage?: number;
  healAmount?: number;
  targetId?: EntityId;
  targetName?: string;
}

/**
 * Build an ABILITY_USED event from context and execution results.
 */
export function buildAbilityUsedEvent(
  context: AbilityContext,
  abilityId: string,
  abilityName: string,
  result: AbilityExecutionResult,
): DomainEvent[] {
  const event: DomainEvent = {
    type: 'ABILITY_USED',
    playerId: context.player.id,
    abilityId,
    abilityName,
    targetId: result.targetId,
    targetName: result.targetName,
    damage: result.damage,
    healAmount: result.healAmount,
    timestamp: context.state.turnNumber,
    turnNumber: context.state.turnNumber,
  };

  return [event];
}
