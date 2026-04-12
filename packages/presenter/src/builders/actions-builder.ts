import type { GameState, WeaponTemplate, EnemyInstance } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { ABILITY_DEFINITIONS, OBJECT_TEMPLATES } from '@dungeon/content';
import type { AvailableAction } from '../game-view.js';
import { chebyshevDistance } from '../utils.js';

/**
 * Helper to check if player can retreat (without importing from game-core to avoid circular dep).
 */
function canRetreat(state: GameState): boolean {
  if (!state.run || state.phase !== 'dungeon') return false;

  const playerKey = posKey(state.player.position);
  const cell = state.run.floor.cells.get(playerKey);
  if (!cell) return false;

  // Can retreat from entrance or stairs_up
  return cell.tile.type === 'stairs_up' ||
    (state.player.position.x === state.run.floor.entrance.x &&
     state.player.position.y === state.run.floor.entrance.y);
}

export function buildAvailableActions(state: GameState): AvailableAction[] {
  let actions: AvailableAction[] = [];

  if (state.phase === 'town') {
    const townActions: AvailableAction[] = [
      { id: 'enter_dungeon', label: 'Enter Dungeon', type: 'town', enabled: true },
      { id: 'rest', label: 'Rest & Heal', type: 'town', enabled: state.player.stats.health < state.player.stats.maxHealth },
      { id: 'shop', label: 'Visit Shop', type: 'town', enabled: true },
    ];
    actions = [...actions, ...townActions];

    // NPC talk actions
    const npcActions = state.world.npcs
      .filter(npc => npc.available)
      .map(npc => ({
        id: `talk_${npc.id}`,
        label: `Talk to ${npc.name}`,
        type: 'town' as const,
        enabled: true,
        targetId: npc.id,
      }));
    actions = [...actions, ...npcActions];

    return actions;
  }

  if (state.phase === 'dungeon' && state.run) {
    // Movement
    const movementActions: AvailableAction[] = [
      { id: 'move_n', label: 'Move North', type: 'move', enabled: true },
      { id: 'move_s', label: 'Move South', type: 'move', enabled: true },
      { id: 'move_e', label: 'Move East', type: 'move', enabled: true },
      { id: 'move_w', label: 'Move West', type: 'move', enabled: true },
    ];
    actions = [...actions, ...movementActions];

    // Determine equipped weapon range
    let attackRange = 1;
    let minRange = 0;
    if (state.player.equipment.weapon) {
      const wt = state.itemRegistry.items.get(state.player.equipment.weapon);
      if (wt && wt.itemClass === 'weapon') {
        attackRange = (wt as WeaponTemplate).weapon.weaponRange ?? 1;
        minRange = (wt as WeaponTemplate).weapon.minRange ?? 0;
      }
    }

    // Attack enemies within weapon range
    const attackActions = Array.from(state.run.enemies.values())
      .filter(enemy => {
        const dist = chebyshevDistance(state.player.position, enemy.position);
        if (dist > attackRange || dist < minRange) return false;
        const cell = state.run!.floor.cells.get(posKey(enemy.position));
        return cell?.visibility === 'visible';
      })
      .map(enemy => ({
        id: `attack_${enemy.id}`,
        label: chebyshevDistance(state.player.position, enemy.position) > 1
          ? `Shoot ${enemy.name}`
          : `Attack ${enemy.name}`,
        type: 'attack' as const,
        enabled: true,
        targetId: enemy.id,
      }));
    actions = [...actions, ...attackActions];

    // Wait
    actions = [...actions, { id: 'wait', label: 'Wait', type: 'wait', enabled: true }];

    // Retreat (if on entrance/stairs_up)
    if (canRetreat(state)) {
      actions = [...actions, { id: 'retreat', label: 'Retreat to Town', type: 'retreat', enabled: true }];
    }

    // Ascend (if on stairs_up with prior floor history)
    const playerCell = state.run.floor.cells.get(posKey(state.player.position));
    if (playerCell?.tile.type === 'stairs_up' && state.run.floorHistory.length > 0) {
      actions = [...actions, { id: 'ascend', label: 'Ascend (<)', type: 'ascend', enabled: true }];
    }

    // Object interactions: check player's current position and 8 neighbors
    const playerPos = state.player.position;
    let objectActions: AvailableAction[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const pos = { x: playerPos.x + dx, y: playerPos.y + dy };
        const key = posKey(pos);
        const obj = (state.run.objects ?? new Map()).get(key);
        if (obj) {
          const template = OBJECT_TEMPLATES.get(obj.templateId);
          const label = template ? `${template.name}` : 'Interact';
          objectActions = [...objectActions, {
            id: `interact_${key}`,
            label,
            type: 'interact',
            enabled: true,
            targetPosition: pos,
          }];
        }
      }
    }
    actions = [...actions, ...objectActions];

    // Ability actions (show ALL abilities, with cooldown/target info) - Phase B
    const abilityActions = (state.player.abilities ?? [])
      .filter(ability => {
        const def = ABILITY_DEFINITIONS[ability.id];
        // Filter out abilities that require specific weapon types if player doesn't have a matching one
        if (def?.requiresWeaponTypes && def.requiresWeaponTypes.length > 0) {
          if (!state.player.equipment.weapon) return false;
          const wt = state.itemRegistry.items.get(state.player.equipment.weapon);
          if (!wt || wt.itemClass !== 'weapon') return false;
          const weaponType = (wt as WeaponTemplate).weapon.weaponType;
          return def.requiresWeaponTypes.includes(weaponType);
        }
        return true;
      })
      .map(ability => {
        const def = ABILITY_DEFINITIONS[ability.id];
        const isReady = ability.cooldownRemaining === 0;

        // B2: Add cooldown label suffix if on cooldown
        let label = def?.name ?? ability.id;
        if (!isReady) {
          label += ` (${ability.cooldownRemaining} turn${ability.cooldownRemaining === 1 ? '' : 's'})`;
        }

        // A6: Check target validation for targeted abilities using ability-specific range
        let enabled = isReady;
      let targetId: string | undefined;
      if (enabled && def?.requiresTarget) {
        // Determine range for this ability: ranged abilities use weapon range, others use melee (1)
        let abilityRange = 1; // Default melee range
        if (def?.requiresWeaponTypes?.includes('ranged') && state.player.equipment.weapon) {
          const wt = state.itemRegistry.items.get(state.player.equipment.weapon);
          if (wt && wt.itemClass === 'weapon') {
            abilityRange = (wt as WeaponTemplate).weapon.weaponRange ?? 1;
          }
        }

        // Find nearest enemy within this ability's range
        let nearestEnemy: EnemyInstance | null = null;
        let nearestDist = Infinity;
        for (const enemy of state.run!.enemies.values()) {
          const dist = chebyshevDistance(state.player.position, enemy.position);
          if (dist >= 1 && dist <= abilityRange && dist < nearestDist) {
            nearestEnemy = enemy;
            nearestDist = dist;
          }
        }

        if (nearestEnemy) {
          targetId = nearestEnemy.id;
        } else {
          label += ' (no target)';
          enabled = false;
        }
      }

      return {
        id: `use_ability_${ability.id}`,
        label,
        type: 'ability' as const,
        enabled,
        description: def?.description,  // B1: Add description
        targetId,  // Include targetId for targeted abilities
      };
    });
    actions = [...actions, ...abilityActions];

    // Consumables in actions panel (equipping is handled by InventoryPanel)
    const itemActions = state.player.inventory.flatMap(itemId => {
      const template = state.itemRegistry.items.get(itemId);
      if (template?.itemClass === 'consumable') {
        return {
          id: `use_${itemId}`,
          label: `Use ${template.name}`,
          type: 'item' as const,
          enabled: true,
          targetId: itemId,
        };
      }
      return [];
    });
    actions = [...actions, ...itemActions];
  }

  return actions;
}
