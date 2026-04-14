import type { GameState, TownState, NemesisRecord } from '@dungeon/contracts';
import { ITEM_BY_ID, TOWN_DESCRIPTIONS, getFactionIdsForTemplate, isRarityBuyable } from '@dungeon/content';
import type { TownView, FactionView, NemesisView, ShopItemView, RunSummaryStats } from '../game-view.js';

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

function computeFactionTrend(
  factionId: string,
  nemeses: readonly NemesisRecord[],
): 'rising' | 'falling' | 'stable' {
  const factionNemeses = nemeses.filter(n =>
    getFactionIdsForTemplate(n.sourceTemplateId).includes(factionId)
  );
  if (factionNemeses.length === 0) return 'stable';

  const hasActive = factionNemeses.some(n => n.isActive);
  if (hasActive) return 'rising';
  return 'falling';
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

  const nemesisPromoted = recentEvents.some(e => e.type === 'NEMESIS_PROMOTED');

  return {
    floorsCleared: metrics.floorsCleared,
    enemiesKilled: metrics.enemiesKilled,
    goldEarned: metrics.goldEarned,
    prosperityDelta,
    fearDelta,
    corruptionDelta,
    nemesisPromoted,
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

  // Active nemesis with known weakness
  let nemesisAdvice: string[] = [];
  for (const nemesis of state.world.nemeses.filter(n => n.isActive)) {
    if (nemesis.weaknesses.length > 0) {
      nemesisAdvice = [...nemesisAdvice, `${nemesis.name} is weak to ${nemesis.weaknesses.join(', ')}. Equip accordingly.`];
    }
  }
  advice = [...advice, ...nemesisAdvice];

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

export function buildTownView(state: GameState): TownView {
  const discountPct = shopkeeperDiscountPct(state);
  return {
    prosperity: state.world.town.prosperity,
    fear: state.world.town.fear,
    corruption: state.world.town.corruption,
    rumors: state.world.town.rumors,
    lastRunSummary: state.world.town.lastRunSummary,
    atmosphereDescription: buildAtmosphereDescription(state.world.town),
    factions: state.world.factions.map((f): FactionView => ({
      id: f.id,
      name: f.name,
      power: f.power,
      disposition: f.disposition,
      trend: computeFactionTrend(f.id, state.world.nemeses),
    })),
    nemeses: state.world.nemeses
      .filter(n => n.isActive)
      .map((n): NemesisView => ({
        id: n.id,
        name: n.name,
        title: n.title,
        tier: n.tier,
        rank: n.rank,
        floorOfAscension: n.floorOfAscension,
        killCount: n.killCount,
        killedByWeaponType: n.killedByWeaponType,
        isActive: n.isActive,
        weaknesses: n.weaknesses,
      })),
    slainNemeses: state.world.nemeses
      .filter(n => !n.isActive)
      .map((n): NemesisView => ({
        id: n.id,
        name: n.name,
        title: n.title,
        tier: n.tier,
        rank: n.rank,
        floorOfAscension: n.floorOfAscension,
        killCount: n.killCount,
        killedByWeaponType: n.killedByWeaponType,
        isActive: n.isActive,
        weaknesses: n.weaknesses,
      })),
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
          return {
            itemId: si.itemId,
            name: template?.name ?? si.itemId,
            description: template?.description ?? '',
            rarity: template?.rarity ?? 'common',
            price: si.price,
            effectivePrice,
            stock: si.stock,
            itemClass: template?.itemClass ?? 'unknown',
            spriteName: template?.spriteName,
            weaponData: template?.itemClass === 'weapon' && 'weapon' in template ? template.weapon : undefined,
            armorData: template?.itemClass === 'armor' && 'armor' in template ? template.armor : undefined,
          } satisfies ShopItemView;
        }),
      canUndo: !!state.world.shop.lastTransaction,
    },
    unlockedBlueprints: state.world.unlockedBlueprints,
    runSummaryStats: buildRunSummaryStats(state),
    prepAdvice: buildPrepAdvice(state),
    lastRetreatFloor: state.lastRetreatFloor,
  };
}
