import type { GameState, TownState } from '@dungeon/contracts';
import { ENCHANTMENT_BY_ID, ITEM_BY_ID, TOWN_DESCRIPTIONS, getEnchantmentCost, isRarityBuyable, getRarityColor, getDamageBand, getWeaponDamageProfile } from '@dungeon/content';
import type { EnchantmentBlueprintView, ShopItemView, RunSummaryStats, TownView, TownStudyableSpellView } from '../game-view.js';
import { buildFactionPressureSummary, buildFactionView, buildOgreProgressView } from './faction-progress-builder.js';
import {
  evaluateAllRingSpellStudy,
  getEquippedRingItemIds,
  getNextSchoolDisplayLevelXp,
  getSchoolDisplayLevelFromXp,
} from '@dungeon/core';

function shopkeeperDiscountPct(state: GameState): number {
  const shopkeeper = state.world.npcs.find(n => n.role === 'shopkeeper');
  if (!shopkeeper) return 0;
  return Math.min(25, Math.floor(shopkeeper.disposition / 10) * 5);
}

function buildAtmosphereDescription(town: TownState): string {
  if (town.corruption >= 60) return TOWN_DESCRIPTIONS.corrupted;
  if (town.fear >= 60) return TOWN_DESCRIPTIONS.fearful;
  if (town.prosperity >= 70) return TOWN_DESCRIPTIONS.prosperous;
  return TOWN_DESCRIPTIONS.normal;
}

function buildRunSummaryStats(state: GameState): RunSummaryStats | null {
  const metrics = state.run?.runMetrics ?? state.lastRunMetrics;
  if (!metrics) return null;

  const recentEvents = state.world.eventHistory.slice(-20);
  const townChanges = recentEvents.filter(e => e.type === 'TOWN_STATE_CHANGED');

  let prosperityDelta = 0;
  let fearDelta = 0;
  let corruptionDelta = 0;
  for (const e of townChanges) {
    if (e.type !== 'TOWN_STATE_CHANGED') continue;
    const delta = e.newValue - e.oldValue;
    if (e.field === 'prosperity') prosperityDelta += delta;
    else if (e.field === 'fear') fearDelta += delta;
    else if (e.field === 'corruption') corruptionDelta += delta;
  }

  return {
    floorsCleared: metrics.floorsCleared,
    enemiesKilled: metrics.enemiesKilled,
    goldEarned: metrics.goldEarned,
    prosperityDelta,
    fearDelta,
    corruptionDelta,
    equipmentLost: [],
  };
}

function buildPrepAdvice(state: GameState): string[] {
  let advice: string[] = [];

  // No weapon equipped
  if (!state.player.equipment.weapon) {
    advice = [...advice, 'You have no weapon equipped. Visit the shop or check your inventory.'];
  }

  // Low health
  if (state.player.stats.health < state.player.stats.maxHealth * 0.5) {
    advice = [...advice, 'Your health is low. Rest at the inn before venturing out.'];
  }

  // No consumables
  const consumableCount = state.player.inventory.filter(id => {
    const tpl = state.itemRegistry.items.get(id);
    return tpl?.itemClass === 'consumable';
  }).length;
  if (consumableCount === 0) {
    advice = [...advice, 'You have no consumables. Buy potions from the shop.'];
  }

  // High corruption warning
  if (state.world.town.corruption > 75) {
    advice = [...advice, 'Corruption is dangerously high. Enemies in the dungeon will be stronger.'];
  }

  return advice;
}

function buildStudyableSpells(state: GameState): readonly TownStudyableSpellView[] {
  const equippedItemIds = getEquippedRingItemIds(state.player.equipment, state.itemRegistry.items);

  return evaluateAllRingSpellStudy(state.player, equippedItemIds)
    .filter(evalResult => evalResult.visibleForStudy)
    .map(evalResult => {
      // Use first school gate for legacy current/next level fields
      const primaryGate = evalResult.schoolGates[0];
      const currentSchoolLevel = primaryGate ? getSchoolDisplayLevelFromXp(primaryGate.currentXp) : 0;
      const nextSchoolLevelXp = primaryGate ? getNextSchoolDisplayLevelXp(primaryGate.currentXp) : 0;

      // Build mastery data for all schools on this spell
      const schoolMasteries = evalResult.spell.schools.map(school => {
        const schoolXp = ((state.player.ringMastery as Record<string, { xp: number }>)[school]?.xp ?? 0);
        const displayLevel = getSchoolDisplayLevelFromXp(schoolXp);
        const nextLevelXp = getNextSchoolDisplayLevelXp(schoolXp);
        return {
          school,
          xp: schoolXp,
          displayLevel,
          nextDisplayLevelXp: nextLevelXp,
        };
      });

      return {
        spellId: evalResult.spell.id,
        name: evalResult.spell.name,
        description: evalResult.spell.description,
        schools: evalResult.spell.schools,
        cooldown: evalResult.spell.cooldown,
        manaCost: evalResult.spell.manaCost ?? 0,
        xpGainOnCast: evalResult.spell.xpGainOnCast,
        baseDamage: evalResult.spell.baseDamage ?? 0,
        range: evalResult.spell.range,
        unlockLevel: primaryGate?.requiredXp ?? 0,
        learned: evalResult.alreadyLearned,
        unlocked: evalResult.unlockedForStudy,
        affordable: evalResult.affordable,
        canStudy: evalResult.canStudy,
        schoolGates: evalResult.schoolGates.map(gate => ({
          school: gate.school,
          currentXp: gate.currentXp,
          requiredXp: gate.requiredXp,
          met: gate.met,
        })),
        goldCost: evalResult.goldCost,
        currentSchoolLevel,
        nextSchoolLevelXp,
        schoolMasteries,
      } satisfies TownStudyableSpellView;
    });
}

function buildUnlockedEnchantmentBlueprints(state: GameState): readonly EnchantmentBlueprintView[] {
  return state.world.unlockedBlueprints
    .map(enchantmentId => {
      const definition = ENCHANTMENT_BY_ID.get(enchantmentId);
      if (definition === undefined) return null;
      return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        tier: definition.tier,
        cost: getEnchantmentCost(definition.id),
      } satisfies EnchantmentBlueprintView;
    })
    .filter((blueprint): blueprint is EnchantmentBlueprintView => blueprint !== null);
}

export function buildTownView(state: GameState): TownView {
  const discountPct = shopkeeperDiscountPct(state);
  return {
    prosperity: state.world.town.prosperity,
    fear: state.world.town.fear,
    corruption: state.world.town.corruption,
    rumors: state.world.town.rumors,
    lastRunSummary: state.world.town.lastRunSummary,
    atmosphereDescription: buildAtmosphereDescription(state.world.town),
    factions: state.world.factions.map(faction => buildFactionView(faction)),
    factionPressureSummary: buildFactionPressureSummary(state.world),
    ogreProgress: buildOgreProgressView(state.world),
    npcs: state.world.npcs.map(npc => ({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      available: npc.available,
    })),
    shop: {
      // Low prosperity limits shop availability; higher rarity requires finding items first
      items: state.world.shop.items
        .filter(si => si.stock > 0)
        .filter((_, idx) => state.world.town.prosperity >= 25 || idx < 3) // below 25 prosperity: only 3 items
        .filter(si => {
          const template = ITEM_BY_ID.get(si.itemId);
          if (!template) return false;
          return isRarityBuyable(template.rarity, state.world.highestRarityFound ?? 'common');
        })
        .map(si => {
          const template = ITEM_BY_ID.get(si.itemId);
          const effectivePrice = Math.max(1, Math.floor(si.price * (1 - discountPct / 100)));
          const rarity = template?.rarity ?? 'common';
          return {
            itemId: si.itemId,
            name: template?.name ?? si.itemId,
            description: template?.description ?? '',
            rarity,
            rarityColor: getRarityColor(rarity),
            price: si.price,
            effectivePrice,
            stock: si.stock,
            itemClass: template?.itemClass ?? 'unknown',
            spriteName: template?.spriteName,
            weaponData: template?.itemClass === 'weapon' && 'weapon' in template
              ? (() => {
                const weapon = template.weapon;
                const profile = getWeaponDamageProfile(weapon.weaponType, weapon.weaponRange);
                const { min, max } = getDamageBand(weapon.damage, profile);
                return { 
                  damage: weapon.damage, 
                  damageMin: min, 
                  damageMax: max, 
                  damageType: weapon.damageType, 
                  accuracy: weapon.accuracy, 
                  speed: weapon.speed, 
                  weaponRange: weapon.weaponRange, 
                  minRange: weapon.minRange,
                  onHitStatus: weapon.onHitStatus,
                  onHitChance: weapon.onHitChance,
                };
              })()
              : undefined,
            armorData: template?.itemClass === 'armor' && 'armor' in template ? template.armor : undefined,
          } satisfies ShopItemView;
        }),
      canUndo: !!state.world.shop.lastTransaction,
    },
    unlockedBlueprints: state.world.unlockedBlueprints,
    unlockedEnchantmentBlueprints: buildUnlockedEnchantmentBlueprints(state),
    runSummaryStats: buildRunSummaryStats(state),
    prepAdvice: buildPrepAdvice(state),
    studyableSpells: buildStudyableSpells(state),
    lastRetreatFloor: state.lastRetreatFloor,
  };
}
