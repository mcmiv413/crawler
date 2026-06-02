import type { GameState, UseAbilityCommand } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import type { CommandResult } from './handlers/shared.js';
import { handleThunderStep } from './handlers/thunder-step.js';

type CustomRingSpellHandler = (
  state: GameState,
  command: UseAbilityCommand,
  rng: SeededRNG,
) => CommandResult;

const customRingSpellHandlers: Map<string, CustomRingSpellHandler> = new Map([
  ['thunder_step', handleThunderStep as CustomRingSpellHandler],
]);

export function getCustomRingSpellHandler(effectHandlerId: string): CustomRingSpellHandler | undefined {
  return customRingSpellHandlers.get(effectHandlerId);
}

export function getAllCustomRingSpellHandlerIds(): string[] {
  return Array.from(customRingSpellHandlers.keys());
}
