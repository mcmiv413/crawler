import type { DomainEvent } from '@dungeon/contracts';
import type { AbilityContext, AbilityEffect } from '../types.js';
import { applyAttack } from './apply-attack.js';
import { applyHeal } from './apply-heal.js';
import { applyStatus } from './apply-status.js';
import { applyStatModifier } from './apply-stat-modifier.js';
import { applyConditional } from './apply-conditional.js';

/**
 * Dispatcher for applying effects based on their kind.
 * Routes to specific apply-*.ts handlers.
 */
export function applyEffect(
  context: AbilityContext,
  effect: AbilityEffect,
  targetKey?: string,
  priorHit?: boolean,
): { state: typeof context.state; events: readonly DomainEvent[]; hit?: boolean; damage?: number } {
  switch (effect.kind) {
    case 'attack':
      return applyAttack(context, effect, targetKey ?? '');
    case 'heal':
      return applyHeal(context, effect);
    case 'status':
      return applyStatus(context, effect, targetKey ?? '', priorHit ?? false);
    case 'modify_stat':
      return applyStatModifier(context, effect, targetKey ?? '');
    case 'conditional':
      return applyConditional(context, effect, targetKey ?? '', priorHit ?? false);
    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new Error(`Unknown effect kind: ${(effect as any).kind}`);

  }
}
