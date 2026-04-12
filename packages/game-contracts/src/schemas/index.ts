import { z } from 'zod';

const DirectionSchema = z.enum(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);

const TownActionSchema = z.enum(['shop_buy', 'shop_sell', 'shop_undo', 'rest', 'talk_npc', 'prepare', 'enter_dungeon', 'enchant_armor']);

export const MoveCommandSchema = z.object({
  type: z.literal('MOVE'),
  direction: DirectionSchema,
});

export const AttackCommandSchema = z.object({
  type: z.literal('ATTACK'),
  targetId: z.string(),
});

export const UseItemCommandSchema = z.object({
  type: z.literal('USE_ITEM'),
  itemId: z.string(),
  targetId: z.string().optional(),
});

export const InteractCommandSchema = z.object({
  type: z.literal('INTERACT'),
  targetPosition: z.object({ x: z.number(), y: z.number() }),
});

export const WaitCommandSchema = z.object({
  type: z.literal('WAIT'),
});

export const RetreatCommandSchema = z.object({
  type: z.literal('RETREAT'),
});

export const TownActionCommandSchema = z.object({
  type: z.literal('TOWN_ACTION'),
  action: TownActionSchema,
  targetId: z.string().optional(),
  itemId: z.string().optional(),
  startDepth: z.number().int().optional(),
});

export const EquipCommandSchema = z.object({
  type: z.literal('EQUIP'),
  itemId: z.string(),
});

export const AscendCommandSchema = z.object({
  type: z.literal('ASCEND'),
});

export const UseAbilityCommandSchema = z.object({
  type: z.literal('USE_ABILITY'),
  abilityId: z.string(),
  targetId: z.string().optional(),
});

export const UnequipCommandSchema = z.object({
  type: z.literal('UNEQUIP'),
  itemId: z.string(),
});

export const SwapWeaponsCommandSchema = z.object({
  type: z.literal('SWAP_WEAPONS'),
});

export const EnchantArmorCommandSchema = z.object({
  type: z.literal('ENCHANT_ARMOR'),
  equipSlot: z.enum(['weapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2']),
  enchantmentId: z.string(),
});

export const ToggleDebugCommandSchema = z.object({
  type: z.literal('TOGGLE_DEBUG'),
});

export const GameCommandSchema = z.discriminatedUnion('type', [
  MoveCommandSchema,
  AttackCommandSchema,
  UseItemCommandSchema,
  InteractCommandSchema,
  WaitCommandSchema,
  RetreatCommandSchema,
  TownActionCommandSchema,
  EquipCommandSchema,
  UnequipCommandSchema,
  SwapWeaponsCommandSchema,
  AscendCommandSchema,
  UseAbilityCommandSchema,
  EnchantArmorCommandSchema,
  ToggleDebugCommandSchema,
]);

export const CreateGameSchema = z.object({
  seed: z.number().int().optional(),
  playerName: z.string().min(1).max(30).optional(),
});
