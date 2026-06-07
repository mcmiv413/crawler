/**
 * Centralized registry of player action rejection reason codes.
 *
 * Use these constants in validators and handlers instead of inline strings.
 * This prevents typos, enables grep-based audits, and keeps codes stable
 * across refactors.
 *
 * Groups:
 *   ABILITY  — ability execution and tile-target validation
 *   TOWN     — town transaction validation
 *   EQUIPMENT — equipment constraint validation
 *   ITEM     — item usage validation
 *   COMBAT   — combat resolution (Phase 3)
 */

// ---------------------------------------------------------------------------
// Ability rejection codes (used by validateAbilityAction and executeAbility)
// ---------------------------------------------------------------------------
export const ABILITY_NOT_FOUND = 'ABILITY_NOT_FOUND' as const;
export const ABILITY_REQUIREMENTS_NOT_MET = 'ABILITY_REQUIREMENTS_NOT_MET' as const;
export const ABILITY_NOT_AVAILABLE = 'ABILITY_NOT_AVAILABLE' as const;
export const ABILITY_ON_COOLDOWN = 'ABILITY_ON_COOLDOWN' as const;
export const INSUFFICIENT_MANA = 'INSUFFICIENT_MANA' as const;
export const MISSING_TILE_TARGET = 'MISSING_TILE_TARGET' as const;
export const WRONG_PHASE = 'WRONG_PHASE' as const;
export const INVALID_TILE_TARGET = 'INVALID_TILE_TARGET' as const;
export const TILE_NOT_VISIBLE = 'TILE_NOT_VISIBLE' as const;
export const TILE_OCCUPIED = 'TILE_OCCUPIED' as const;
export const OUT_OF_RANGE = 'OUT_OF_RANGE' as const;

// ---------------------------------------------------------------------------
// Town rejection codes (used by validateTownTransaction)
// ---------------------------------------------------------------------------
export const SPELL_NOT_FOUND = 'SPELL_NOT_FOUND' as const;
export const SPELL_STUDY_INELIGIBLE = 'SPELL_STUDY_INELIGIBLE' as const;
export const ITEM_NOT_FOR_SALE = 'ITEM_NOT_FOR_SALE' as const;
export const INSUFFICIENT_GOLD = 'INSUFFICIENT_GOLD' as const;
export const QUEST_NOT_FOUND = 'QUEST_NOT_FOUND' as const;
export const QUEST_NOT_READY = 'QUEST_NOT_READY' as const;

// ---------------------------------------------------------------------------
// Equipment rejection codes (used by validateEquipmentAction)
// ---------------------------------------------------------------------------
export const ITEM_NOT_FOUND = 'ITEM_NOT_FOUND' as const;
export const ITEM_NOT_EQUIPPABLE = 'ITEM_NOT_EQUIPPABLE' as const;
export const ITEM_NOT_IN_INVENTORY = 'ITEM_NOT_IN_INVENTORY' as const;
export const EQUIPMENT_INCOMPATIBLE = 'EQUIPMENT_INCOMPATIBLE' as const;

// ---------------------------------------------------------------------------
// Item rejection codes (used by inventory handlers)
// ---------------------------------------------------------------------------
export const ITEM_UNUSABLE = 'ITEM_UNUSABLE' as const;
export const ITEM_WRONG_PHASE = 'ITEM_WRONG_PHASE' as const;

// ---------------------------------------------------------------------------
// Union type for all known rejection reason codes
// ---------------------------------------------------------------------------
export type RejectionCode =
  | typeof ABILITY_NOT_FOUND
  | typeof ABILITY_REQUIREMENTS_NOT_MET
  | typeof ABILITY_NOT_AVAILABLE
  | typeof ABILITY_ON_COOLDOWN
  | typeof INSUFFICIENT_MANA
  | typeof MISSING_TILE_TARGET
  | typeof WRONG_PHASE
  | typeof INVALID_TILE_TARGET
  | typeof TILE_NOT_VISIBLE
  | typeof TILE_OCCUPIED
  | typeof OUT_OF_RANGE
  | typeof SPELL_NOT_FOUND
  | typeof SPELL_STUDY_INELIGIBLE
  | typeof ITEM_NOT_FOR_SALE
  | typeof INSUFFICIENT_GOLD
  | typeof QUEST_NOT_FOUND
  | typeof QUEST_NOT_READY
  | typeof ITEM_NOT_FOUND
  | typeof ITEM_NOT_EQUIPPABLE
  | typeof ITEM_NOT_IN_INVENTORY
  | typeof EQUIPMENT_INCOMPATIBLE
  | typeof ITEM_UNUSABLE
  | typeof ITEM_WRONG_PHASE;
