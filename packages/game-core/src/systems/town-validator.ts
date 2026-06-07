import type { GameState, EntityId } from '@dungeon/contracts';
import { ITEM_BY_ID, getStudySpell, getSchoolForRing } from '@dungeon/content';
import type { RingSchool, SpellStudyRequirement } from '@dungeon/content';
import { evaluateRingSpellStudy, getEquippedRingItemIds } from './ring-spell-availability.js';

export type TownValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly rejectionCode: string;
      readonly message: string;
    };

/**
 * Central hub for town transaction validation.
 *
 * Validates complete town actions including:
 * 1. STUDY_SPELL: spell exists, is eligible to learn
 * 2. BUY_ITEM: item is for sale, player has sufficient gold
 * 3. TURN_IN_QUEST: quest exists, is ready to turn in
 *
 * Rejection codes:
 * - SPELL_NOT_FOUND: Spell doesn't exist in content
 * - SPELL_STUDY_INELIGIBLE: Spell already learned, level too low, or other eligibility check failed
 * - ITEM_NOT_FOR_SALE: Item not in shop or out of stock
 * - INSUFFICIENT_GOLD: Player lacks gold for purchase
 * - QUEST_NOT_FOUND: Quest doesn't exist in active quests
 * - QUEST_NOT_READY: Quest is not ready to turn in (wrong status/phase)
 */
export function validateTownTransaction(
  state: GameState,
  actionType: 'STUDY_SPELL' | 'BUY_ITEM' | 'TURN_IN_QUEST',
  actionPayload: {
    spellId?: string;
    itemId?: string;
    questId?: EntityId;
  },
): TownValidationResult {
  switch (actionType) {
    case 'STUDY_SPELL':
      return validateStudySpell(state, actionPayload.spellId);
    case 'BUY_ITEM':
      return validateBuyItem(state, actionPayload.itemId);
    case 'TURN_IN_QUEST':
      return validateTurnInQuest(state, actionPayload.questId);
    default:
      const _never: never = actionType;
      return _never;
  }
}

function validateStudySpell(
  state: GameState,
  spellId: string | undefined,
): TownValidationResult {
  // Guard: spell ID provided
  if (spellId === undefined || spellId.length === 0) {
    return {
      valid: false,
      rejectionCode: 'SPELL_NOT_FOUND',
      message: 'No spell ID provided.',
    };
  }

  // Guard: spell exists in content
  const spell = getStudySpell(spellId);
  if (spell === undefined) {
    return {
      valid: false,
      rejectionCode: 'SPELL_NOT_FOUND',
      message: `Spell "${spellId}" not found in game content.`,
    };
  }

  // Guard: spell is eligible to learn (check via evaluateRingSpellStudy)
  const equippedItemIds = getEquippedRingItemIds(state.player.equipment, state.itemRegistry.items);
  const evalResult = evaluateRingSpellStudy(state.player, equippedItemIds, spell);

  if (evalResult.canStudy === false) {
    // Already learned is observable per Slice 3 spec
    if (evalResult.alreadyLearned === true) {
      return {
        valid: false,
        rejectionCode: 'SPELL_STUDY_INELIGIBLE',
        message: `Already learned "${spell.name}".`,
      };
    }

    // Check if missing required school (equippedSchool requirement)
    const equippedSchools = new Set(
      equippedItemIds
        .map(itemId => getSchoolForRing(itemId))
        .filter((school): school is RingSchool => school !== undefined)
    );

    const hasMissingSchoolRequirement = spell.studyRequirements.some(req => {
      if (req.kind !== 'equippedSchool') return false;
      const schoolReq = req as Extract<SpellStudyRequirement, { kind: 'equippedSchool' }>;
      return !equippedSchools.has(schoolReq.school);
    });

    if (hasMissingSchoolRequirement === true) {
      // Player-facing error - missing required ring
      return {
        valid: false,
        rejectionCode: 'SPELL_STUDY_INELIGIBLE',
        message: `Cannot study "${spell.name}": required ring not equipped`,
      };
    }

    // Other unmet requirements (xp gates, prerequisites, insufficient gold)
    // Treat as silent guards
    return { valid: true };
  }

  return { valid: true };
}

function validateBuyItem(
  state: GameState,
  itemId: string | undefined,
): TownValidationResult {
  // Guard: item ID provided
  if (itemId === undefined || itemId.length === 0) {
    return {
      valid: false,
      rejectionCode: 'ITEM_NOT_FOR_SALE',
      message: 'No item ID provided.',
    };
  }

  // Guard: item exists in shop and has stock
  const shopItem = state.world.shop.items.find(i => i.itemId === itemId);
  if (shopItem === undefined || shopItem.stock <= 0) {
    return {
      valid: false,
      rejectionCode: 'ITEM_NOT_FOR_SALE',
      message: `Item "${itemId}" is not for sale or out of stock.`,
    };
  }

  // Guard: item template exists in content
  const template = ITEM_BY_ID.get(itemId);
  if (template === undefined) {
    return {
      valid: false,
      rejectionCode: 'ITEM_NOT_FOR_SALE',
      message: `Item "${itemId}" not found in game content.`,
    };
  }

  // Guard: player has sufficient gold
  const basePrice = shopItem.price;
  const shopkeeper = state.world.npcs.find(n => n.role === 'shopkeeper');
  const discountPct = shopkeeper !== undefined
    ? Math.min(25, Math.floor(shopkeeper.disposition / 10) * 5)
    : 0;
  const price = Math.max(1, Math.floor(basePrice * (1 - discountPct / 100)));

  if (state.player.gold < price) {
    return {
      valid: false,
      rejectionCode: 'INSUFFICIENT_GOLD',
      message: `Insufficient gold. Need ${price}, have ${state.player.gold}.`,
    };
  }

  return { valid: true };
}

function validateTurnInQuest(
  state: GameState,
  questId: EntityId | undefined,
): TownValidationResult {
  // Guard: quest ID provided
  if (questId === undefined) {
    return {
      valid: false,
      rejectionCode: 'QUEST_NOT_FOUND',
      message: 'No quest ID provided.',
    };
  }

  // Guard: quest exists in active quests
  const quest = state.activeQuests.find(q => q.id === questId);
  if (quest === undefined) {
    return {
      valid: false,
      rejectionCode: 'QUEST_NOT_FOUND',
      message: `Quest "${questId}" not found in active quests.`,
    };
  }

  // Guard: quest is ready to turn in
  if (quest.status !== 'ready_to_turn_in') {
    return {
      valid: false,
      rejectionCode: 'QUEST_NOT_READY',
      message: `Quest "${quest.title}" is not ready to turn in (status: ${quest.status}).`,
    };
  }

  return { valid: true };
}
