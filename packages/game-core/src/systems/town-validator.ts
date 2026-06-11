import type { GameState, EntityId, EquipSlot, ArmorTemplate } from '@dungeon/contracts';
import { ITEM_BY_ID, ENCHANTMENT_BY_ID, getEnchantmentCost, getStudySpell, getSchoolForRing } from '@dungeon/content';
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
 * 4. ENCHANT_ARMOR: enchantment exists, is unlocked, armor slot can accept it
 *
 * Rejection codes:
 * - SPELL_NOT_FOUND: Spell doesn't exist in content
 * - SPELL_STUDY_INELIGIBLE: Spell already learned, level too low, or other eligibility check failed
 * - ITEM_NOT_FOR_SALE: Item not in shop or out of stock
 * - INSUFFICIENT_GOLD: Player lacks gold for purchase
 * - QUEST_NOT_FOUND: Quest doesn't exist in active quests
 * - QUEST_NOT_READY: Quest is not ready to turn in (wrong status/phase)
 * - ENCHANTMENT_NOT_FOUND: Enchantment doesn't exist in content
 * - ENCHANTMENT_NOT_UNLOCKED: Enchantment blueprint hasn't been unlocked
 * - NO_ENCHANTMENT_SLOT: Target slot/item cannot accept the enchantment
 * - DUPLICATE_ENCHANTMENT: Target item already has this enchantment
 */
export function validateTownTransaction(
  state: GameState,
  actionType: 'STUDY_SPELL' | 'BUY_ITEM' | 'TURN_IN_QUEST' | 'ENCHANT_ARMOR',
  actionPayload: {
    spellId?: string;
    itemId?: string;
    questId?: EntityId;
    equipSlot?: EquipSlot;
    enchantmentId?: string;
  },
): TownValidationResult {
  switch (actionType) {
    case 'STUDY_SPELL':
      return validateStudySpell(state, actionPayload.spellId);
    case 'BUY_ITEM':
      return validateBuyItem(state, actionPayload.itemId);
    case 'TURN_IN_QUEST':
      return validateTurnInQuest(state, actionPayload.questId);
    case 'ENCHANT_ARMOR':
      return validateEnchantArmor(state, actionPayload.equipSlot, actionPayload.enchantmentId);
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

    if (evalResult.affordable === false) {
      return {
        valid: false,
        rejectionCode: 'INSUFFICIENT_GOLD',
        message: `Cannot study "${spell.name}": requires ${evalResult.goldCost} gold.`,
      };
    }

    const unmetPrerequisite = spell.studyRequirements.find(req =>
      req.kind === 'prerequisiteSpell' && !state.player.learnedRingSpellIds.includes(req.spellId)
    );
    if (unmetPrerequisite?.kind === 'prerequisiteSpell') {
      return {
        valid: false,
        rejectionCode: 'SPELL_STUDY_INELIGIBLE',
        message: `Cannot study "${spell.name}": requires ${unmetPrerequisite.spellId}.`,
      };
    }

    const unmetGate = evalResult.schoolGates.find(gate => gate.met === false);
    if (unmetGate !== undefined) {
      return {
        valid: false,
        rejectionCode: 'SPELL_STUDY_INELIGIBLE',
        message: `Cannot study "${spell.name}": ${unmetGate.school} XP ${unmetGate.currentXp}/${unmetGate.requiredXp}.`,
      };
    }

    return {
      valid: false,
      rejectionCode: 'SPELL_STUDY_INELIGIBLE',
      message: `Cannot study "${spell.name}".`,
    };
  }

  return { valid: true };
}

function validateEnchantArmor(
  state: GameState,
  equipSlot: EquipSlot | undefined,
  enchantmentId: string | undefined,
): TownValidationResult {
  if (state.phase !== 'town') {
    return {
      valid: false,
      rejectionCode: 'WRONG_PHASE',
      message: 'Armor can only be enchanted in town.',
    };
  }

  if (enchantmentId === undefined || enchantmentId.length === 0) {
    return {
      valid: false,
      rejectionCode: 'ENCHANTMENT_NOT_FOUND',
      message: 'No enchantment ID provided.',
    };
  }

  const enchDef = ENCHANTMENT_BY_ID.get(enchantmentId);
  if (enchDef === undefined) {
    return {
      valid: false,
      rejectionCode: 'ENCHANTMENT_NOT_FOUND',
      message: `Enchantment "${enchantmentId}" not found in game content.`,
    };
  }

  if (!state.world.unlockedBlueprints.includes(enchantmentId)) {
    return {
      valid: false,
      rejectionCode: 'ENCHANTMENT_NOT_UNLOCKED',
      message: `${enchDef.name} is not unlocked.`,
    };
  }

  const cost = getEnchantmentCost(enchantmentId);
  if (state.player.gold < cost) {
    return {
      valid: false,
      rejectionCode: 'INSUFFICIENT_GOLD',
      message: `${enchDef.name} requires ${cost} gold.`,
    };
  }

  if (equipSlot === undefined) {
    return {
      valid: false,
      rejectionCode: 'NO_ENCHANTMENT_SLOT',
      message: 'No equipment slot provided.',
    };
  }

  const itemId = state.player.equipment[equipSlot];
  if (itemId === null) {
    return {
      valid: false,
      rejectionCode: 'NO_ENCHANTMENT_SLOT',
      message: 'No item is equipped in that slot.',
    };
  }

  const template = state.itemRegistry.items.get(itemId);
  if (template === undefined || template.itemClass !== 'armor') {
    return {
      valid: false,
      rejectionCode: 'NO_ENCHANTMENT_SLOT',
      message: 'Only armor can be enchanted.',
    };
  }

  const armor = (template as ArmorTemplate).armor;
  if (armor.enchantmentSlots <= 0 || armor.enchantments.length === 0 || armor.enchantments.indexOf(null) === -1) {
    return {
      valid: false,
      rejectionCode: 'NO_ENCHANTMENT_SLOT',
      message: `${template.name} has no open enchantment slot.`,
    };
  }

  if (armor.enchantments.includes(enchantmentId)) {
    return {
      valid: false,
      rejectionCode: 'DUPLICATE_ENCHANTMENT',
      message: `${template.name} already has ${enchDef.name}.`,
    };
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
