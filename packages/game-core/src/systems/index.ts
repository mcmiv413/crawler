export { validateMove, isWalkable } from './movement.js';
export { computeFov } from './fov.js';
export { decideEnemyAction } from './enemy-ai.js';
export { addItemToInventory, removeItemFromInventory, useConsumable } from './inventory.js';
export { calculateEquippedStats, equipItem, unequipItem, swapWeaponSets } from './equipment.js';
export {
  applyStatusToPlayer, applyStatusToEnemy,
  tickPlayerStatuses, getEffectiveStat, hasStatus,
} from './status-effects.js';
export { processEnemyLoot, rollGoldDrop, rollItemDrop } from './loot.js';
export { canRetreat, executeRetreat } from './retreat.js';
export { handlePlayerDeath } from './death.js';
export { processTownAction } from './town.js';
export { processTalkNpc, updateNpcDisposition } from './npc.js';
export { selectBiomeForFloor } from './biome-selection.js';
export { createQuestFromTemplate, selectRandomQuestTemplate } from './quest-selection.js';
export { checkLevelUp } from './progression.js';
export { grantAbility, canUseAbility, tickAbilityCooldowns } from './abilities.js';
export { getValidTrapPlacementDirections } from './trap-placement.js';
export { checkWeaponMasteryUnlocks } from './weapon-mastery.js';
export {
  applyDungeonOgreSlain,
  applyFactionDeathConsequences,
  applyFactionLeaderSlain,
  applyFactionMemberKill,
  applyNewDeepestFloorPressure,
  calculateFactionTownImpact,
  clampFactionPower,
  getFactionMemberStrengthMultiplier,
  getFactionPowerBand,
  getFactionSpawnWeightMultiplier,
  maybeEmergeDungeonOgre,
} from './factions.js';
export { applyRunConsequences, evaluateEventChains } from './world-consequences.js';
export { buildWorldModifiers } from './world-modifiers.js';
export type { WorldModifiers } from './world-modifiers.js';
export { evaluateQuestProgress, getObjectiveText, redeemQuest } from './quest-progress.js';
export { completeFloorDepthQuests } from './quests.js';
export {
  getSchoolMasteryLevel,
  getStudyableRingSpells,
  getEquippedRingItemIds,
  evaluateRingSpellStudy,
  evaluateAllRingSpellStudy,
  canUseLearnedRingSpell,
  type StudyRequirementStatus,
  type SpellStudyEvaluation,
} from './ring-spell-availability.js';
