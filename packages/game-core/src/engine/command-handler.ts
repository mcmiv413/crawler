import type {
  GameState,
  GameCommand,
  MoveCommand,
  AttackCommand,
  UseItemCommand,
  EquipCommand,
  UnequipCommand,
  TownActionCommand,
  InteractCommand,
  UseAbilityCommand,
  EnchantArmorCommand,
  DisarmTrapCommand,
  SetTrapCommand,
  EntityId,
} from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import type { SeededRNG } from '../utils/rng.js';
import type { CommandResult } from './handlers/shared.js';
import { updateRunMetrics } from './handlers/shared.js';
import {
  handleMove,
  handleWait,
  handleInteract,
  handleAttack,
  handleUseAbility,
  handleEquip,
  handleUnequip,
  handleSwapWeapons,
  handleUseItem,
  handleTownAction,
  handleRetreatCommand,
  handleDisarmTrap,
  handleSetTrap,
} from './handlers/index.js';
import { processEnchantArmor } from '../systems/town.js';
import { RING_SPELL_BY_ID } from '@dungeon/content';
import { getCustomRingSpellHandler } from './custom-ring-spell-handlers.js';

export type { CommandResult };
export { updateRunMetrics };

/**
 * Type guards for discriminated union to safely narrow GameCommand variants.
 * These eliminate the need for 'as any' casts while maintaining type safety.
 */
const isMoveCommand = (cmd: GameCommand): cmd is MoveCommand => cmd.type === 'MOVE';
const isAttackCommand = (cmd: GameCommand): cmd is AttackCommand => cmd.type === 'ATTACK';
const isUseItemCommand = (cmd: GameCommand): cmd is UseItemCommand => cmd.type === 'USE_ITEM';
const isEquipCommand = (cmd: GameCommand): cmd is EquipCommand => cmd.type === 'EQUIP';
const isUnequipCommand = (cmd: GameCommand): cmd is UnequipCommand => cmd.type === 'UNEQUIP';
const isTownActionCommand = (cmd: GameCommand): cmd is TownActionCommand => cmd.type === 'TOWN_ACTION';
const isInteractCommand = (cmd: GameCommand): cmd is InteractCommand => cmd.type === 'INTERACT';
const isUseAbilityCommand = (cmd: GameCommand): cmd is UseAbilityCommand => cmd.type === 'USE_ABILITY';
const isEnchantArmorCommand = (cmd: GameCommand): cmd is EnchantArmorCommand => cmd.type === 'ENCHANT_ARMOR';
const isDisarmTrapCommand = (cmd: GameCommand): cmd is DisarmTrapCommand => cmd.type === 'DISARM_TRAP';
const isSetTrapCommand = (cmd: GameCommand): cmd is SetTrapCommand => cmd.type === 'SET_TRAP';

/** Handle a game command, returning new state + events */
export function handleCommand(
  state: GameState,
  command: GameCommand,
  rng: SeededRNG,
): CommandResult {
  switch (command.type) {
    case 'MOVE': {
      if (!isMoveCommand(command)) return { state, events: [], runEnded: false };
      return handleMove(state, command.direction, rng);
    }
    case 'ATTACK': {
      if (!isAttackCommand(command)) return { state, events: [], runEnded: false };
      return handleAttack(state, entityId(command.targetId), rng);
    }
    case 'USE_ITEM': {
      if (!isUseItemCommand(command)) return { state, events: [], runEnded: false };
      return handleUseItem(state, command.itemId, rng, command.targetId !== undefined ? entityId(command.targetId) : undefined);
    }
    case 'WAIT':
      return handleWait(state, rng);
    case 'RETREAT':
      return handleRetreatCommand(state, rng);
    case 'TOWN_ACTION': {
      if (!isTownActionCommand(command)) return { state, events: [], runEnded: false };
      return handleTownAction(state, command.action, rng, command.targetId as EntityId | undefined, command.itemId, command.spellId);
    }
    case 'EQUIP': {
      if (!isEquipCommand(command)) return { state, events: [], runEnded: false };
      return handleEquip(state, command.itemId);
    }
    case 'UNEQUIP': {
      if (!isUnequipCommand(command)) return { state, events: [], runEnded: false };
      return handleUnequip(state, command.itemId);
    }
    case 'SWAP_WEAPONS':
      return handleSwapWeapons(state, rng);
    case 'INTERACT': {
      if (!isInteractCommand(command)) return { state, events: [], runEnded: false };
      return handleInteract(state, command.targetPosition, rng);
    }
    case 'ASCEND':
      return { state, events: [], runEnded: false }; // handled by game engine
    case 'USE_ABILITY': {
      if (!isUseAbilityCommand(command)) return { state, events: [], runEnded: false };
      // Route custom ring spells through their registered handlers
      const ringSpell = RING_SPELL_BY_ID.get(command.abilityId);
      if (ringSpell !== undefined && ringSpell.effectKind === 'custom' && ringSpell.effectHandlerId !== undefined) {
        const handler = getCustomRingSpellHandler(ringSpell.effectHandlerId);
        if (handler !== undefined) {
          return handler(state, command, rng);
        }
        return { state, events: [], runEnded: false };
      }
      return handleUseAbility(state, command.abilityId, rng, command.targetId !== undefined ? entityId(command.targetId) : undefined, command.direction, command.targetPosition);
    }
    case 'ENCHANT_ARMOR': {
      if (!isEnchantArmorCommand(command)) return { state, events: [], runEnded: false };
      if (state.phase !== 'town') return { state, events: [], runEnded: false };
      const result = processEnchantArmor(state, command.equipSlot, command.enchantmentId);
      return { state: result.state, events: result.events, runEnded: false };
    }
    case 'DISARM_TRAP': {
      if (!isDisarmTrapCommand(command)) return { state, events: [], runEnded: false };
      return handleDisarmTrap(state, command.direction, rng);
    }
    case 'SET_TRAP': {
      if (!isSetTrapCommand(command)) return { state, events: [], runEnded: false };
      return handleSetTrap(state, command.direction, entityId(command.itemEntityId), rng);
    }
    case 'TOGGLE_DEBUG':
      return {
        state: { ...state, debugMode: state.debugMode !== true },
        events: [],
        runEnded: false,
      };
    default: {
      // Exhaustiveness check — TypeScript ensures all GameCommand variants are handled
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
