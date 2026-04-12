/**
 * strategies.ts — Four distinct game-playing strategies: random, greedy, smart, and LM-assisted
 */

import type { GameCommand } from '@dungeon/contracts';
import type { GameView, AvailableAction } from '@dungeon/presenter';
import { queryLmStudio } from './lm-client.js';
import { pathfindToStairs, pathfindToFrontier, pathfindToEnemy } from './pathfinding.js';
import { tryShopBuy, tryEnchant, trySmartEquip, trySmartConsumable, trySellJunk } from './town-logic.js';
import { actionToCommand } from './simulation.js';

// ---------------------------------------------------------------------------
// Random Strategy
// ---------------------------------------------------------------------------

export function randomStrategy(view: GameView): GameCommand | null {
  const enabled = view.availableActions.filter(a => a.enabled);
  if (enabled.length === 0) return null;
  const pick = enabled[Math.floor(Math.random() * enabled.length)];
  if (!pick) return null;
  return actionToCommand(pick);
}

// ---------------------------------------------------------------------------
// Greedy Strategy
// ---------------------------------------------------------------------------

interface GreedyStateTracker {
  turnsUntilReplan: number;  // 0 = replan next turn
}

// Module-level state - reset when entering dungeon
let greedyState: GreedyStateTracker = { turnsUntilReplan: 0 };

export function greedyStrategy(view: GameView): GameCommand | null {
  const enabled = view.availableActions.filter(a => a.enabled);
  const hp = view.player.health;
  const maxHp = view.player.maxHealth;
  const hpPct = hp / maxHp;

  const find = (pred: (a: AvailableAction) => boolean) => enabled.find(pred);

  // Town phase: rest if hurt, shop, equip, enchant, then enter dungeon
  if (view.phase === 'town') {
    // Reset state on entry
    greedyState.turnsUntilReplan = 0;

    if (hpPct < 0.8) {
      const rest = find(a => a.id === 'rest');
      if (rest) return actionToCommand(rest);
    }
    const shopCmd = tryShopBuy(view);
    if (shopCmd) return shopCmd;
    const sellCmd = trySellJunk(view);
    if (sellCmd) return sellCmd;
    const equipCmd = trySmartEquip(view, 0, null);
    if (equipCmd) return equipCmd;
    const enchantCmd = tryEnchant(view);
    if (enchantCmd) return enchantCmd;
    const enter = find(a => a.id === 'enter_dungeon');
    if (enter) return actionToCommand(enter);
    return null;
  }

  const inDungeon = view.phase === 'dungeon';

  // 1. Smart equip comparison
  const equipCmd = trySmartEquip(view, 0, null);
  if (equipCmd) return equipCmd;

  // 1.5. Weapon swap (ranged ↔ melee based on enemy distance)
  const swapCmd = tryWeaponSwap(view);
  if (swapCmd) return swapCmd;

  // 2. Smart consumables
  const consumeCmd = trySmartConsumable(view, inDungeon);
  if (consumeCmd) return consumeCmd;

  // 3. Use ability first (cooldown managed by engine; power_strike = 2× damage)
  // Note: swap_weapons has type === 'ability' but is handled separately, so skip it here
  const ability = find(a => a.type === 'ability' && a.id !== 'swap_weapons');
  if (ability) return actionToCommand(ability);

  // 4. Attack any visible enemy
  const attack = find(a => a.type === 'attack');
  if (attack) return actionToCommand(attack);

  // 5. Interact (chests, interactables)
  const interact = find(a => a.type === 'interact');
  if (interact) return actionToCommand(interact);

  // 6. Emergency retreat or ascend (HP < 25%) — BEFORE approaching enemies
  if (hpPct < 0.25) {
    const retreat = find(a => a.type === 'retreat' || a.id === 'retreat');
    if (retreat) return actionToCommand(retreat);
    const ascend = find(a => a.type === 'ascend' || a.id === 'ascend');
    if (ascend) return actionToCommand(ascend);
  }

  // 7. Approach nearest visible enemy
  const approachMove = pathfindToEnemy(view);
  if (approachMove) return approachMove;

  // 8. Navigate to stairs_down if already visible (before frontier to prioritize descent)
  const stairsMove = pathfindToStairs(view);
  if (stairsMove) return stairsMove;

  // 9. Explore toward frontier (with replan commitment every 8 turns to reduce BFS cost)
  greedyState.turnsUntilReplan--;
  let frontierMove: GameCommand | null = null;

  if (greedyState.turnsUntilReplan <= 0) {
    frontierMove = pathfindToFrontier(view);
    if (frontierMove) {
      greedyState.turnsUntilReplan = 8; // Replan every 8 turns (reduces BFS cost ~87%)
    }
  } else {
    // Between replans: try a random move toward unexplored area
    const moves = enabled.filter(a => ['move_n', 'move_s', 'move_e', 'move_w'].includes(a.id));
    if (moves.length > 0) {
      frontierMove = actionToCommand(moves[Math.floor(Math.random() * moves.length)]!);
    }
  }

  if (frontierMove) return frontierMove;

  // 10. Random move (shouldn't reach here often with frontier BFS)
  const moves = enabled.filter(a => ['move_n', 'move_s', 'move_e', 'move_w'].includes(a.id));
  if (moves.length > 0) {
    const move = moves[Math.floor(Math.random() * moves.length)];
    if (move) return actionToCommand(move);
  }

  // 11. Wait
  const wait = find(a => a.id === 'wait');
  if (wait) return actionToCommand(wait);

  return null;
}

// ---------------------------------------------------------------------------
// Smart Strategy
// ---------------------------------------------------------------------------

interface SmartStateTracker {
  lastSwapFloor: number;  // Floor where last weapon swap occurred
}

// Module-level state - tracks weapon swap floor for mastery diversification
let smartState: SmartStateTracker = { lastSwapFloor: -5 };

/**
 * Threat assessment for smart retreat decisions.
 * Returns a threat score (0-1) based on nearby enemy density, distance, and damage potential.
 */
export function assessThreatLevel(view: GameView): number {
  const { map, enemies } = view;
  if (!map || !enemies || enemies.length === 0) return 0;

  const playerPos = map.playerPosition;
  let threatScore = 0;

  for (const enemy of enemies) {
    // Distance-based threat: closer = higher threat
    const dx = enemy.position.x - playerPos.x;
    const dy = enemy.position.y - playerPos.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // Enemies at distance 1-2 are very threatening
    if (dist <= 1) {
      threatScore += 0.5; // Melee adjacent
    } else if (dist <= 3) {
      threatScore += 0.3; // Ranged close
    } else if (dist <= 5) {
      threatScore += 0.15; // Medium range
    } else if (dist <= 8) {
      threatScore += 0.05; // Far but visible
    }
  }

  // Cap threat score at 1.0
  return Math.min(1.0, threatScore);
}

/**
 * Weapon swap logic: switch between ranged and melee based on enemy proximity.
 * - If ranged equipped and an enemy is adjacent (dist <= 1): swap to melee
 * - If melee equipped and no enemies visible: swap to ranged (return to default posture)
 */
export function tryWeaponSwap(view: GameView): GameCommand | null {
  const enabled = view.availableActions.filter(a => a.enabled);
  const swapAction = enabled.find(a => a.id === 'swap_weapons');
  if (!swapAction) return null;

  const primaryWeapon = view.inventory.equipped.weapon;
  const secondaryWeapon = view.inventory.equipped.secondaryWeapon;

  if (!primaryWeapon || !secondaryWeapon) return null; // Need both to swap

  // Check if primary weapon is ranged (minRange > 1)
  const isRanged = primaryWeapon.weaponStats?.minRange && primaryWeapon.weaponStats.minRange > 1;

  // Check for visible enemies and their distances
  const enemies = view.map?.entities?.filter(e => e.type === 'enemy') ?? [];
  const playerPos = view.map?.playerPosition;

  // Case 1: Ranged equipped and an enemy is adjacent → swap to melee
  if (isRanged && playerPos && enemies.length > 0) {
    for (const enemy of enemies) {
      const dx = Math.abs(enemy.x - playerPos.x);
      const dy = Math.abs(enemy.y - playerPos.y);
      const dist = Math.max(dx, dy); // Chebyshev distance
      if (dist <= 1) {
        return { type: 'SWAP_WEAPONS' };
      }
    }
  }

  // Case 2: Melee equipped and no enemies visible → swap to ranged (return to default posture)
  if (!isRanged && enemies.length === 0) {
    const secondaryIsRanged = secondaryWeapon.weaponStats?.minRange && secondaryWeapon.weaponStats.minRange > 1;
    if (secondaryIsRanged) {
      return { type: 'SWAP_WEAPONS' };
    }
  }

  return null;
}

/**
 * Kiting logic: maintain distance from enemies while using ranged attacks.
 * Returns a retreat command if an enemy is too close and the player has ranged capability.
 */
export function tryKite(view: GameView, enabled: AvailableAction[]): GameCommand | null {
  if (!view.map) return null;

  // Get visible enemies from map entities
  const enemies = view.map.entities?.filter((e) => e.type === 'enemy') ?? [];
  if (enemies.length === 0) return null;

  const playerPos = view.map.playerPosition;

  // Check if player has ranged weapon (primary weapon type)
  const primaryWeapon = view.inventory.equipped.weapon;
  if (!primaryWeapon || primaryWeapon.weaponStats?.damageType === 'slash' || primaryWeapon.weaponStats?.damageType === 'bludgeon') {
    return null; // Not a ranged player
  }

  // Find closest enemy
  let closestDist = Infinity;
  for (const enemy of enemies) {
    const dx = enemy.x - playerPos.x;
    const dy = enemy.y - playerPos.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance
    if (dist < closestDist) closestDist = dist;
  }

  // If closest enemy is adjacent (dist <= 1) and we have ranged weapon, kite away
  if (closestDist <= 1) {
    // Try to move away (use frontier/stairs as fallback target)
    const stairsMove = pathfindToStairs(view);
    if (stairsMove) return stairsMove;

    const frontierMove = pathfindToFrontier(view);
    if (frontierMove) return frontierMove;

    // Random move away as fallback
    const moves = enabled.filter(a => ['move_n', 'move_s', 'move_e', 'move_w', 'move_ne', 'move_nw', 'move_se', 'move_sw'].includes(a.id));
    if (moves.length > 0) {
      const move = moves[Math.floor(Math.random() * moves.length)];
      if (move) return actionToCommand(move);
    }
  }

  return null;
}

export function smartStrategy(
  view: GameView,
  masteryHits: number,
  committedType: string | null,
  deepestFloor?: number,
): GameCommand | null {
  const enabled = view.availableActions.filter(a => a.enabled);
  const hp = view.player.health;
  const maxHp = view.player.maxHealth;
  const hpPct = hp / maxHp;

  const find = (pred: (a: AvailableAction) => boolean) => enabled.find(pred);

  // Town phase: rest if hurt, sell wrong-type weapons, shop, equip, enchant if possible, enter
  if (view.phase === 'town') {
    // Reset weapon swap tracking when re-entering town (new dungeon run)
    smartState.lastSwapFloor = -5;

    if (hpPct < 0.8) {
      const rest = find(a => a.id === 'rest');
      if (rest) return actionToCommand(rest);
    }
    const sellCmd = trySellJunk(view);
    if (sellCmd) return sellCmd;
    const shopCmd = tryShopBuy(view);
    if (shopCmd) return shopCmd;
    const equipCmd = trySmartEquip(view, masteryHits, committedType);
    if (equipCmd) return equipCmd;
    const enchantCmd = tryEnchant(view);
    if (enchantCmd) return enchantCmd;
    const enter = find(a => a.id === 'enter_dungeon');
    if (enter) {
      // Area 4b: Re-entry with floor skip
      const cmd = actionToCommand(enter);
      if (cmd.type === 'TOWN_ACTION' && deepestFloor !== undefined && deepestFloor > 1) {
        const maxAllowed = Math.max(1, deepestFloor - 1);
        return { ...cmd, startDepth: maxAllowed };
      }
      return cmd;
    }
    return null;
  }

  const inDungeon = view.phase === 'dungeon';

  // 1. Smart equip with mastery commitment
  const equipCmd = trySmartEquip(view, masteryHits, committedType);
  if (equipCmd) return equipCmd;

  // 1.3. Weapon swap (ranged ↔ melee based on enemy distance)
  const swapCmd = tryWeaponSwap(view);
  if (swapCmd) return swapCmd;

  // 1.5. Weapon set switching: if committed after 10 hits, and a second weapon exists,
  //      swap every 5 floors to build secondary mastery
  if (masteryHits >= 10 && committedType && view.player.floor > 0) {
    const secondaryWeapon = view.inventory.equipped.secondaryWeapon;
    const primaryWeapon = view.inventory.equipped.weapon;

    // Check if secondary weapon is different type from committed type
    if (secondaryWeapon && primaryWeapon &&
        secondaryWeapon.weaponStats && primaryWeapon.weaponStats &&
        secondaryWeapon.weaponStats.damageType !== committedType) {
      // Swap every 5 floors to diversify mastery accumulation
      if (view.player.floor - smartState.lastSwapFloor >= 5) {
        const swapAction = find(a => a.id === 'swap_weapons');
        if (swapAction) {
          smartState.lastSwapFloor = view.player.floor;
          return actionToCommand(swapAction);
        }
      }
    }
  }

  // 2. Smart consumables
  const consumeCmd = trySmartConsumable(view, inDungeon);
  if (consumeCmd) return consumeCmd;

  // 3. Use ability first (cooldown managed by engine; power_strike = 2× damage)
  // Note: swap_weapons has type === 'ability' but is handled separately, so skip it here
  const ability = find(a => a.type === 'ability' && a.id !== 'swap_weapons');
  if (ability) return actionToCommand(ability);

  // 4. Attack any visible enemy
  const attack = find(a => a.type === 'attack');
  if (attack) return actionToCommand(attack);

  // 5. Interact (chests, interactables)
  const interact = find(a => a.type === 'interact');
  if (interact) return actionToCommand(interact);

  // 6. Threat-aware and status-aware retreat (BEFORE approach) — prevents walking into danger
  //    - Base: retreat if HP < 25% (lowered from 35%)
  //    - Status bonus: if slow or weaken is active, raise retreat threshold to 40%
  //    - Threat bonus: if HP < 50% AND threat is high (multiple enemies nearby)
  const hasSlow = view.player.statuses.some(s => s.name.toLowerCase().includes('slow'));
  const hasWeaken = view.player.statuses.some(s => s.name.toLowerCase().includes('weaken'));

  const threatLevel = assessThreatLevel(view);
  const statusRetreatThreshold = (hasSlow || hasWeaken) ? 0.40 : 0.25;
  const shouldRetreat = hpPct < statusRetreatThreshold || (hpPct < 0.50 && threatLevel >= 0.5);

  if (shouldRetreat) {
    const retreat = find(a => a.type === 'retreat' || a.id === 'retreat');
    if (retreat) return actionToCommand(retreat);
    const ascend = find(a => a.type === 'ascend' || a.id === 'ascend');
    if (ascend) return actionToCommand(ascend);
  }

  // 7. Approach nearest visible enemy
  const approachMove = pathfindToEnemy(view);
  if (approachMove) return approachMove;

  // 7.5. Kiting: maintain distance with ranged weapons
  const kiteMove = tryKite(view, enabled);
  if (kiteMove) return kiteMove;

  // 8. Navigate to stairs_down if already visible (before frontier to prioritize descent)
  const stairsMove = pathfindToStairs(view);
  if (stairsMove) return stairsMove;

  // 9. Explore toward frontier
  const frontierMove = pathfindToFrontier(view);
  if (frontierMove) return frontierMove;

  // 10. Random move fallback
  const moves = enabled.filter(a => ['move_n', 'move_s', 'move_e', 'move_w'].includes(a.id));
  if (moves.length > 0) {
    const move = moves[Math.floor(Math.random() * moves.length)];
    if (move) return actionToCommand(move);
  }

  // 11. Wait
  const wait = find(a => a.id === 'wait');
  if (wait) return actionToCommand(wait);

  return null;
}

// ---------------------------------------------------------------------------
// LM Strategy
// ---------------------------------------------------------------------------

/** Fire LM queries during combat, near-combat, low HP, or town decisions */
export function shouldQueryLm(view: GameView, turnsSinceEnemy: number): boolean {
  const hasEnemies = view.availableActions.some(a => a.type === 'attack' && a.enabled);
  const recentEnemy = turnsSinceEnemy <= 10;
  const hpPct = view.player.health / view.player.maxHealth;
  return hasEnemies || recentEnemy || hpPct < 0.5 || view.phase === 'town';
}

export async function lmStrategy(
  view: GameView,
  onFallback: () => void,
): Promise<GameCommand | null> {
  const enabled = view.availableActions.filter((a) => a.enabled === true);
  if (enabled.length === 0) return null;

  const statusList = view.player.statuses.length > 0
    ? view.player.statuses.map((s) => s.name).join(', ')
    : 'none';

  const enemyList = view.map?.entities
    ?.filter((e) => e.type === 'enemy')
    .map((e) => `${e.name} (HP: ${e.health ?? '?'})`)
    .join(', ') ?? 'none';

  const recentLog = view.combatLog.slice(-3).map((e) => e.text).join('; ') ?? 'none';

  const actionList = enabled
    .map((a, i) => `${i}: ${String(a.id)} — ${String(a.label)}`)
    .join('\n');

  const prompt = `You are playing a dungeon crawl RPG. Choose the best next action.

GAME STATE:
- Phase: ${view.phase} | Floor: ${view.player.floor} | HP: ${view.player.health}/${view.player.maxHealth}
- Attack: ${view.player.attack} | Defense: ${view.player.defense} | Gold: ${view.player.gold}
- Statuses: ${statusList}

ENEMIES NEARBY: ${enemyList}

RECENT EVENTS: ${recentLog}

AVAILABLE ACTIONS:
${actionList}

Reply with ONLY the number of your chosen action.`;

  const result = await queryLmStudio(prompt);

  if (result.text !== null) {
    const match = result.text.match(/\d+/);
    if (match) {
      const idx = parseInt(match[0], 10);
      if (idx >= 0 && idx < enabled.length) {
        const action = enabled[idx];
        if (action) return actionToCommand(action);
      }
    }
  }

  onFallback();
  return greedyStrategy(view);
}
