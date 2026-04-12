/**
 * simulation.ts — Game session simulation and equipment tracking
 */

import { GameEngine } from '@dungeon/core';
import type { GameCommand, GameState, RunMetrics, WeaponMastery, WorldState, EnchantmentAppliedEvent } from '@dungeon/contracts';
import { EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import { buildGameView } from '@dungeon/presenter';
import type { GameView, AvailableAction, InventoryItemView } from '@dungeon/presenter';
import type { WeaponTemplate } from '@dungeon/contracts';
import { randomStrategy, greedyStrategy, smartStrategy, shouldQueryLm, lmStrategy } from './strategies.js';
import type { EquipmentSnapshot, RunResult, BfsNode } from './types.js';

// ---------------------------------------------------------------------------
// Action Command Conversion
// ---------------------------------------------------------------------------

export function actionToCommand(action: AvailableAction): GameCommand | null {
  const id = action.id;

  if (id === 'move_n') return { type: 'MOVE', direction: 'N' };
  if (id === 'move_s') return { type: 'MOVE', direction: 'S' };
  if (id === 'move_e') return { type: 'MOVE', direction: 'E' };
  if (id === 'move_w') return { type: 'MOVE', direction: 'W' };
  if (id === 'wait') return { type: 'WAIT' };
  if (id === 'retreat') return { type: 'RETREAT' };
  if (id === 'ascend') return { type: 'ASCEND' };
  if (id === 'enter_dungeon') return { type: 'TOWN_ACTION', action: 'enter_dungeon' };
  if (id === 'rest') return { type: 'TOWN_ACTION', action: 'rest' };
  if (id === 'swap_weapons') return { type: 'SWAP_WEAPONS' };

  if (id.startsWith('attack_') && action.targetId) {
    return { type: 'ATTACK', targetId: action.targetId };
  }
  if (id.startsWith('equip_') && action.targetId) {
    return { type: 'EQUIP', itemId: action.targetId };
  }
  if (id.startsWith('use_ability_')) {
    // Presenter generates: use_ability_<abilityId>; targetId is optional for AOE abilities
    const abilityId = id.slice('use_ability_'.length);
    return { type: 'USE_ABILITY', abilityId, targetId: action.targetId };
  }
  if (id.startsWith('use_') && action.targetId) {
    return { type: 'USE_ITEM', itemId: action.targetId };
  }
  if (id.startsWith('interact_') && action.targetPosition) {
    // Presenter generates: interact_<posKey>
    return { type: 'INTERACT', targetPosition: action.targetPosition };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Equipment Snapshot
// ---------------------------------------------------------------------------

export function buildEquipmentSnapshot(view: GameView, peakArmorSlotsFilled: number): EquipmentSnapshot {
  const inv = view.inventory;
  const weapon = inv.equipped.weapon;
  const armorSlots = [inv.equipped.chest, inv.equipped.head, inv.equipped.gloves, inv.equipped.boots, inv.equipped.ring1, inv.equipped.ring2];
  const filledSlots = armorSlots.filter(s => s !== null).length;

  const totalDefense = armorSlots.reduce((sum, slot) => {
    if (!slot || !slot.armorStats) return sum;
    return sum + slot.armorStats.defense;
  }, 0);

  const equippedRarities: Record<string, number> = {};
  if (weapon) equippedRarities[weapon.rarity] = (equippedRarities[weapon.rarity] ?? 0) + 1;
  for (const slot of armorSlots) {
    if (slot) equippedRarities[slot.rarity] = (equippedRarities[slot.rarity] ?? 0) + 1;
  }

  return {
    weaponName: weapon?.name ?? null,
    weaponDamage: weapon?.weaponStats?.damage ?? 0,
    weaponType: weapon?.weaponStats?.damageType ?? null,
    totalDefenseFromGear: totalDefense,
    armorSlotsFilled: filledSlots,
    peakArmorSlotsFilled,
    equippedRarities,
  };
}

// ---------------------------------------------------------------------------
// Session Simulation
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 50;           // more entries = more nemesis opportunities
const MAX_TOTAL_TURNS = 50_000;    // generous budget: ~50-200 turns/floor × 5 floors = ~250-1000/entry
const MAX_TURNS_PER_ENTRY = 5_000; // let greedy reach floors 4-5 with safety margin

interface SessionResult {
  run: RunResult;
  finalWorld: WorldState;
}

export async function simulateSession(
  engine: GameEngine,
  runIndex: number,
  strategy: 'random' | 'greedy' | 'smart' | 'lm',
  seed: number,
  lmAvailable: boolean,
  campaignIndex: number,
  inheritedWorld: WorldState | null,
): Promise<SessionResult> {
  let state: GameState = engine.createNewGame(seed);

  // Inject inherited world state for campaign mode
  if (inheritedWorld !== null) {
    state = { ...state, world: inheritedWorld };
  }

  const startGold = state.player.gold;

  // Cumulative session metrics
  let dungeonEntries = 0;
  let totalFloorsDescended = 0;
  let totalTurnsElapsed = 0;
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let totalEnemiesKilled = 0;
  let totalItemsUsed = 0;
  let totalGoldEarned = 0;
  let maxFloorReached = 0;
  let floorOfDeath: number | null = null;
  let lmFallbackCount = 0;
  let lastMastery: WeaponMastery = { ...EMPTY_WEAPON_MASTERY };

  // Death consequence tracking
  let permadeaths = 0;
  let maxOverkillDamage = 0;
  let nemesisPromotions = 0;
  let deathStashRecoveries = 0;
  let deathStashLosses = 0;

  // Extended tracking
  let shopPurchaseCount = 0;
  let shopPurchaseGold = 0;
  let restCost = 0;
  let weaponSwitchCount = 0;
  let potionsUsed = 0;
  let bombsUsed = 0;
  let elixirsUsed = 0;

  // Phase 2: Status effects and damage tracking
  const statusesInflicted: Record<string, number> = {};
  let fireDamageReceived = 0;
  let physicalDamageReceived = 0;
  let weaponSwapsIssued = 0;
  const abilityUsageBreakdown: Record<string, number> = {};
  let npcInteractionCount = 0;

  // Phase 3: Enchantment tracking
  let enchantmentsApplied = 0;
  let enchantmentGoldSpent = 0;
  const enchantmentBreakdown: Record<string, number> = {};

  // Phase 4: Dungeon loot tracking
  let chestsOpened = 0;
  let itemsFromChests = 0;
  let rawLootAcquiredCount = 0;  // total LOOT_ACQUIRED events (replaces approximation)
  let itemsDropped = 0;  // LOOT_DROPPED events (inventory full)
  let itemsSoldCount = 0;
  let itemsSoldGold = 0;
  let peakArmorSlotsFilled = 0;  // max armor slots filled at any point

  // Smart strategy state
  let masteryHits = 0;
  let committedType: string | null = null;
  let lastEquippedWeaponType: string | null = null;

  let sessionEndReason: RunResult['sessionEndReason'] = 'max_entries';
  let sessionEnded = false;

  let globalTurnsUsed = 0;

  for (let entry = 0; entry < MAX_ENTRIES && !sessionEnded; entry++) {
    let lastMetrics: RunMetrics | null = null;
    let entryDamageTaken = 0;
    let entryTurns = 0;
    let entryFloorsDescended = 0;
    let entryEndReason: 'death' | 'retreat' | 'victory' | 'permadeath' | 'max_turns' | null = null;
    let turnsSinceEnemy = 999;

    for (let turn = 0; globalTurnsUsed < MAX_TOTAL_TURNS && entryTurns < MAX_TURNS_PER_ENTRY; turn++) {
      globalTurnsUsed++;
      const view = buildGameView(state);
      maxFloorReached = Math.max(maxFloorReached, state.player.floor);

      // Track peak armor slots filled during session
      const armorSlotsNow = [view.inventory.equipped.chest, view.inventory.equipped.head,
        view.inventory.equipped.gloves, view.inventory.equipped.boots,
        view.inventory.equipped.ring1, view.inventory.equipped.ring2].filter(s => s !== null).length;
      peakArmorSlotsFilled = Math.max(peakArmorSlotsFilled, armorSlotsNow);

      const hasEnemiesNow = view.availableActions.some(a => a.type === 'attack' && a.enabled);
      turnsSinceEnemy = hasEnemiesNow ? 0 : turnsSinceEnemy + 1;

      const hpBefore = state.player.stats.health;

      // Track weapon type for mastery commitment
      if (state.run?.weaponMastery) {
        const wm = state.run.weaponMastery;
        const types: Array<keyof WeaponMastery> = ['blade', 'bludgeon', 'axe', 'ranged'];
        const primary = types.reduce((best, t) => wm[t] > wm[best] ? t : best, types[0]!);
        masteryHits = wm[primary];
        if (masteryHits >= 10 && committedType === null) {
          committedType = primary;
        }
      }

      let cmd: GameCommand | null = null;
      try {
        if (strategy === 'random') {
          cmd = randomStrategy(view);
        } else if (strategy === 'greedy') {
          cmd = greedyStrategy(view);
        } else if (strategy === 'smart') {
          cmd = smartStrategy(view, masteryHits, committedType, state.world.deepestFloor);
        } else {
          if (lmAvailable && shouldQueryLm(view, turnsSinceEnemy)) {
            cmd = await lmStrategy(view, () => { lmFallbackCount++; });
          } else {
            cmd = greedyStrategy(view);
          }
        }
      } catch (err) {
        console.error(`Strategy ${strategy} failed at turn ${turn} on floor ${state.player.floor}:`, err);
        cmd = { type: 'WAIT' }; // fallback to wait
      }

      if (!cmd) {
        cmd = state.phase === 'town'
          ? { type: 'TOWN_ACTION', action: 'enter_dungeon' }
          : { type: 'WAIT' };
      }

      // Track extended metrics before command execution
      const goldBeforeCmd = state.player.gold;
      const equippedWeaponBefore = state.player.equipment.weapon;
      const isEnchanting = cmd.type === 'ENCHANT_ARMOR';

      // Track consumable usage
      if (cmd.type === 'USE_ITEM') {
        const tpl = state.itemRegistry.items.get(cmd.itemId);
        if (tpl) {
          const nameLower = tpl.name.toLowerCase();
          if (nameLower.includes('health') || nameLower.includes('potion')) potionsUsed++;
          else if (nameLower.includes('bomb') || nameLower.includes('grenade')) bombsUsed++;
          else if (nameLower.includes('elixir') || nameLower.includes('strength')) elixirsUsed++;
          else potionsUsed++; // generic consumable
        }
      }

      // Track shop purchases
      if (cmd.type === 'TOWN_ACTION' && cmd.action === 'shop_buy' && cmd.itemId) {
        shopPurchaseCount++;
        // Price will be reflected in gold delta after command
      }

      // Track shop sells
      if (cmd.type === 'TOWN_ACTION' && cmd.action === 'shop_sell') {
        itemsSoldCount++;
      }

      // Track rest cost
      const isResting = cmd.type === 'TOWN_ACTION' && cmd.action === 'rest';
      const goldBeforeRest = isResting ? state.player.gold : 0;

      // Snapshot pre-command metrics (in case state.run is nullified on death)
      const preCommandMetrics = state.run?.runMetrics ?? null;

      const floorBeforeCmd = state.player.floor;
      const result = engine.submitCommand(state, cmd);

      // Post-command tracking
      const goldAfterCmd = result.state.player.gold;
      if (cmd.type === 'TOWN_ACTION' && cmd.action === 'shop_buy') {
        const spent = goldBeforeCmd - goldAfterCmd;
        if (spent > 0) shopPurchaseGold += spent;
      }
      if (cmd.type === 'TOWN_ACTION' && cmd.action === 'shop_sell') {
        const earned = goldAfterCmd - goldBeforeCmd;
        if (earned > 0) itemsSoldGold += earned;
      }
      if (isResting) {
        const restSpent = goldBeforeRest - goldAfterCmd;
        if (restSpent > 0) restCost += restSpent;
      }
      if (isEnchanting) {
        const spent = goldBeforeCmd - goldAfterCmd;
        if (spent > 0) enchantmentGoldSpent += spent;
      }

      // Track weapon switches and command actions
      if (cmd.type === 'SWAP_WEAPONS') weaponSwapsIssued++;
      if (cmd.type === 'TOWN_ACTION' && cmd.action === 'talk_npc') npcInteractionCount++;

      const equippedWeaponAfter = result.state.player.equipment.weapon;
      if (equippedWeaponAfter !== equippedWeaponBefore && equippedWeaponAfter !== null) {
        const newWeaponTpl = result.state.itemRegistry.items.get(equippedWeaponAfter);
        if (newWeaponTpl && newWeaponTpl.itemClass === 'weapon') {
          const newType = (newWeaponTpl as WeaponTemplate).weapon.weaponType;
          if (lastEquippedWeaponType !== null && newType !== lastEquippedWeaponType) {
            weaponSwitchCount++;
          }
          lastEquippedWeaponType = newType;
        }
      }

      const hpAfter = result.state.player.stats.health;
      entryDamageTaken += Math.max(0, hpBefore - hpAfter);
      entryTurns++;

      // Count net staircase descents (only new-depth arrivals, not oscillations)
      const newFloor = result.state.player.floor;
      if (newFloor > maxFloorReached) entryFloorsDescended++;

      // Capture metrics: prefer post-command, fall back to pre-command if nullified on death
      const postRun = result.state.run;
      if (postRun?.runMetrics) {
        lastMetrics = postRun.runMetrics;
        lastMastery = postRun.weaponMastery;
      } else if (preCommandMetrics) {
        lastMetrics = preCommandMetrics;
        if (state.run?.weaponMastery) lastMastery = state.run.weaponMastery;
      }

      // Track all events
      for (const ev of result.events) {
        if (ev.type === 'PERMADEATH') {
          permadeaths++;
          maxOverkillDamage = Math.max(maxOverkillDamage, ev.overkillDamage);
        }
        if (ev.type === 'NEMESIS_PROMOTED') nemesisPromotions++;
        if (ev.type === 'EQUIPMENT_RECOVERED') deathStashRecoveries++;
        if (ev.type === 'EQUIPMENT_DROPPED') {
          // If player already had a stash when this fires, the old one was lost
          if (state.player.deathStash) deathStashLosses++;
        }
        // Phase 2: Track status effects and damage types
        if (ev.type === 'STATUS_APPLIED') {
          const statusName = ev.statusId ?? 'unknown';
          statusesInflicted[statusName] = (statusesInflicted[statusName] ?? 0) + 1;
        }
        if (ev.type === 'ATTACK_PERFORMED' && ev.hit) {
          const damageType = ev.damageType ?? 'physical';
          const damage = ev.damage ?? 0;
          if (damageType === 'fire') {
            fireDamageReceived += damage;
          } else {
            physicalDamageReceived += damage;
          }
        }
        // Phase 2: Track ability usage
        if (ev.type === 'ABILITY_USED') {
          const abilityId = ev.abilityId ?? 'unknown';
          abilityUsageBreakdown[abilityId] = (abilityUsageBreakdown[abilityId] ?? 0) + 1;
        }
        // Phase 3: Track enchantment applications
        if (ev.type === 'ENCHANTMENT_APPLIED') {
          enchantmentsApplied++;
          const enchEvent = ev as EnchantmentAppliedEvent;
          const encId = enchEvent.enchantmentId;
          enchantmentBreakdown[encId] = (enchantmentBreakdown[encId] ?? 0) + 1;
        }
        // Phase 4: Track dungeon loot sources
        if (ev.type === 'OBJECT_INTERACTED') {
          const objEv = ev as any; // OBJECT_INTERACTED event
          if (objEv.gotLoot) {
            chestsOpened++;
            itemsFromChests++;  // We count 1 item per chest (could be refined to track exact count)
          }
        }
        if (ev.type === 'LOOT_ACQUIRED') rawLootAcquiredCount++;
        if (ev.type === 'LOOT_DROPPED') itemsDropped++;
      }

      if (result.runEnded) {
        const runEndEvent = result.events.find(e => e.type === 'RUN_ENDED');
        if (runEndEvent && 'reason' in runEndEvent) {
          entryEndReason = (runEndEvent as { reason: 'death' | 'retreat' | 'victory' | 'permadeath' }).reason;
        }
        if (entryEndReason === 'death' || entryEndReason === 'permadeath') floorOfDeath = floorBeforeCmd;
        state = result.state;
        break;
      }

      state = result.state;
    }

    if (entryEndReason === null) {
      // Entry ended due to turn limit (global or per-entry)
      entryEndReason = 'max_turns';
    }
    if (globalTurnsUsed >= MAX_TOTAL_TURNS) sessionEnded = true;

    dungeonEntries++;
    totalFloorsDescended += entryFloorsDescended;
    totalTurnsElapsed += entryTurns;
    totalDamageDealt += lastMetrics?.damageDealt ?? 0;
    totalDamageTaken += entryDamageTaken;
    totalEnemiesKilled += lastMetrics?.enemiesKilled ?? 0;
    totalItemsUsed += lastMetrics?.itemsUsed ?? 0;
    totalGoldEarned += lastMetrics?.goldEarned ?? 0;
    // Note: lastMetrics.floorsCleared is victory-only; use totalFloorsDescended for stair tracking

    if (entryEndReason === 'permadeath' || entryEndReason === 'victory' || entryEndReason === 'max_turns') {
      sessionEndReason = entryEndReason;
      sessionEnded = true;
    }
    // death/retreat → loop continues until max_entries or another terminal condition
  }

  const totalGoldSpent = Math.max(0, (startGold + totalGoldEarned) - state.player.gold);

  // Build final view for equipment snapshot and mastery abilities
  const finalView = buildGameView(state);
  const equipmentSnapshot = buildEquipmentSnapshot(finalView, peakArmorSlotsFilled);
  const masteryAbilitiesUnlocked = (state.player.abilities ?? []).length;

  // Count potions left in inventory
  const potionsUnusedAtEnd = finalView.inventory.items.filter(i =>
    i.itemClass === 'consumable' && (
      i.name.toLowerCase().includes('health') || i.name.toLowerCase().includes('potion')
    ),
  ).length;

  // Determine primary weapon type from mastery
  const masteryTypes: Array<keyof WeaponMastery> = ['blade', 'bludgeon', 'axe', 'ranged'];
  const primaryWeaponType = masteryTypes.reduce((best, t) =>
    lastMastery[t] > (best ? lastMastery[best as keyof WeaponMastery] : -1) ? t : best,
    null as string | null,
  );

  const factionsAtHighPower = state.world.factions.filter(f => f.power >= 50).length;

  const run: RunResult = {
    runIndex,
    strategy,
    seed,
    campaignIndex,
    dungeonEntries,
    sessionEndReason,
    maxFloorReached,
    floorOfDeath,
    totalFloorsDescended,
    totalTurnsElapsed,
    totalDamageDealt,
    totalDamageTaken,
    totalEnemiesKilled,
    totalItemsUsed,
    totalGoldEarned,
    totalGoldSpent,
    worldDeepestFloor: state.world.deepestFloor,
    worldNemesisCount: state.world.nemeses.length,
    worldFactionCount: state.world.factions.length,
    weaponMastery: {
      blade: lastMastery.blade,
      bludgeon: lastMastery.bludgeon,
      axe: lastMastery.axe,
      ranged: lastMastery.ranged,
    },
    nemesisEncountered: state.world.nemeses.length > 0,
    lmFallbackCount,
    equipmentSnapshot,
    goldAtEnd: state.player.gold,
    shopPurchaseCount,
    shopPurchaseGold,
    restCost,
    weaponSwitchCount,
    masteryAbilitiesUnlocked,
    primaryWeaponType: primaryWeaponType !== null && lastMastery[primaryWeaponType as keyof WeaponMastery] > 0
      ? primaryWeaponType
      : null,
    potionsUsed,
    potionsUnusedAtEnd,
    bombsUsed,
    elixirsUsed,
    playerLevelAtEnd: state.player.level,
    totalExperience: state.player.experience,
    permadeaths,
    maxOverkillDamage,
    nemesisPromotions,
    deathStashRecoveries,
    deathStashLosses,
    // Phase 2 fields
    statusesInflicted,
    fireDamageReceived,
    physicalDamageReceived,
    townCorruptionFinal: state.world.town.corruption,
    townFearFinal: state.world.town.fear,
    townProsperityFinal: state.world.town.prosperity,
    factionsAtHighPower,
    weaponSwapsIssued,
    abilityUsageBreakdown,
    npcInteractionCount,
    // Phase 3: Enchantments
    enchantmentsApplied,
    enchantmentGoldSpent,
    enchantmentBreakdown,
    // Phase 4: Dungeon loot tracking
    chestsOpened,
    itemsFromChests,
    itemsFromEnemyDrops: Math.max(0, rawLootAcquiredCount - chestsOpened),  // event-driven: total loot minus chest loot
    totalItemsAcquired: rawLootAcquiredCount + shopPurchaseCount,
    itemsDropped,
    itemsSoldCount,
    itemsSoldGold,
  };

  return { run, finalWorld: state.world };
}
