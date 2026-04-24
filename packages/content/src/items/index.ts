import type { AnyItemTemplate } from '@dungeon/contracts';
import { WEAPONS } from './weapons/index.js';
import { ARMOR } from './armor/index.js';
import { CONSUMABLES } from './consumables/index.js';
import { TRAPS } from './traps/index.js';

export const ALL_ITEMS: readonly AnyItemTemplate[] = [
  ...WEAPONS,
  ...ARMOR,
  ...CONSUMABLES,
  ...TRAPS,
];

export const ITEM_BY_ID: ReadonlyMap<string, AnyItemTemplate> = new Map(
  ALL_ITEMS.map(item => [item.itemId, item])
);

export { WEAPONS, ARMOR, CONSUMABLES, TRAPS };

// Re-export individual items from each sub-category
// Note: Explicit imports used instead of wildcard to avoid duplicate export conflicts
export {
  commonDagger, rustySword, ironMace, shortBow, flameDagger, venomBlade, frostAxe, handAxe, warBow, ironSword, stoneHammer,
} from './weapons/index.js';
export {
  leatherVest, chainShirt, plateArmor, fireWardCloak, regenVest, leatherCap, ironHelm, leatherGloves, chainGauntlets,
  leatherBoots, steelSabatons, copperRing, silverBand, spikedLeather, emberCloak, shadowVest, boneGuardPlate, plagueMantle,
  wardenHelm, ironCrown, mindVeil, swiftBoots, phaseSteps, gripGauntlets, leechWraps, venomRing, blessedRing, ironBand, emberRing, shadowRing,
} from './armor/index.js';
export {
  healthPotion, greaterHealthPotion, antidote, strengthElixir, bomb,
} from './consumables/index.js';
export {
  woodenSpikeTrap, ironSpikeTrap, steelSpikeTrap, fireTrap, infernoTrap, blazingTrap, poisonGasTrap, toxicTrap,
  lethalPoisonTrap, frostTrap as frostTrapItem, frozenTrap, absoluteZeroTrap, lightningTrap as lightningTrapItem, thunderTrap, epicInfernoPit,
} from './traps/index.js';
