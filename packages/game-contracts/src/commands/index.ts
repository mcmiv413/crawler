import { type z } from 'zod';
import { type GameCommandSchema } from '../schemas/index.js';

// Derive all command types from Zod schemas — single source of truth
export type GameCommand = z.infer<typeof GameCommandSchema>;
export type MoveCommand = Extract<GameCommand, { type: 'MOVE' }>;
export type AttackCommand = Extract<GameCommand, { type: 'ATTACK' }>;
export type UseItemCommand = Extract<GameCommand, { type: 'USE_ITEM' }>;
export type InteractCommand = Extract<GameCommand, { type: 'INTERACT' }>;
export type WaitCommand = Extract<GameCommand, { type: 'WAIT' }>;
export type RetreatCommand = Extract<GameCommand, { type: 'RETREAT' }>;
export type EquipCommand = Extract<GameCommand, { type: 'EQUIP' }>;
export type UnequipCommand = Extract<GameCommand, { type: 'UNEQUIP' }>;
export type SwapWeaponsCommand = Extract<GameCommand, { type: 'SWAP_WEAPONS' }>;
export type TownActionCommand = Extract<GameCommand, { type: 'TOWN_ACTION' }>;
export type AscendCommand = Extract<GameCommand, { type: 'ASCEND' }>;
export type UseAbilityCommand = Extract<GameCommand, { type: 'USE_ABILITY' }>;
export type EnchantArmorCommand = Extract<GameCommand, { type: 'ENCHANT_ARMOR' }>;

export type CommandType = GameCommand['type'];
