import type { GameState, WeaponTemplate, WeaponType } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { ABILITY_DEFINITIONS, OBJECT_TEMPLATES } from '@dungeon/content';
import type { AvailableAction } from '../game-view.js';
import { chebyshevDistance } from '../utils.js';

type PlayerAbilityState = NonNullable<GameState['player']['abilities']>[number];

/**
 * Helper to check if player can retreat (without importing from game-core to avoid circular dep).
 */
function canRetreat(state: GameState): boolean {
  if (state.run === null || state.phase !== 'dungeon') return false;

  const playerKey = posKey(state.player.position);
  const cell = state.run.floor.cells.get(playerKey);
  if (cell === undefined) return false;

  return cell.tile.type === 'stairs_up' || (
    state.player.position.x === state.run.floor.entrance.x
    && state.player.position.y === state.run.floor.entrance.y
  );
}

function getEquippedWeaponType(state: GameState): WeaponType | null {
  if (state.player.equipment.weapon === null) return null;

  const weaponTemplate = state.itemRegistry.items.get(state.player.equipment.weapon);
  if (weaponTemplate?.itemClass !== 'weapon') return null;

  return (weaponTemplate as WeaponTemplate).weapon.weaponType;
}

function getEquippedWeaponRange(state: GameState): { max: number; min: number } {
  if (state.player.equipment.weapon === null) {
    return { max: 1, min: 0 };
  }

  const weaponTemplate = state.itemRegistry.items.get(state.player.equipment.weapon);
  if (weaponTemplate?.itemClass !== 'weapon') {
    return { max: 1, min: 0 };
  }

  const weapon = (weaponTemplate as WeaponTemplate).weapon;
  return {
    max: weapon.weaponRange ?? 1,
    min: weapon.minRange ?? 0,
  };
}

function getAbilityTargetRange(
  abilityId: string,
  weaponRange: { max: number; min: number },
): { max: number; min: number } {
  const definition = ABILITY_DEFINITIONS.get(abilityId);
  if (definition?.range !== undefined) {
    return {
      max: definition.range,
      min: definition.minRange ?? 0,
    };
  }

  return weaponRange;
}

function isAbilityCompatibleWithEquippedWeapon(
  abilityId: string,
  equippedWeaponType: WeaponType | null,
): boolean {
  const definition = ABILITY_DEFINITIONS.get(abilityId);
  if (definition?.requiresWeaponTypes === undefined || definition.requiresWeaponTypes.length === 0) {
    return true;
  }

  if (equippedWeaponType === null) {
    return false;
  }

  return definition.requiresWeaponTypes.includes(equippedWeaponType);
}

function hasVisibleEnemyTargetInRange(
  state: GameState,
  maxRange: number,
  minRange: number,
): boolean {
  if (state.run === null) return false;

  return Array.from(state.run.enemies.values()).some((enemy) => {
    const distance = chebyshevDistance(state.player.position, enemy.position);
    if (distance > maxRange || distance < minRange) {
      return false;
    }

    const cell = state.run?.floor.cells.get(posKey(enemy.position));
    return cell?.visibility === 'visible';
  });
}

function buildAbilityLabel(
  abilityName: string,
  cooldownRemaining: number,
  requiresTarget: boolean,
  hasTargetInRange: boolean,
): string {
  if (cooldownRemaining > 0) {
    const turnLabel = cooldownRemaining === 1 ? 'turn' : 'turns';
    return `${abilityName} (${cooldownRemaining} ${turnLabel})`;
  }

  if (requiresTarget === true && hasTargetInRange === false) {
    return `${abilityName} (no target)`;
  }

  return abilityName;
}

function buildAbilityAction(
  state: GameState,
  ability: PlayerAbilityState,
  equippedWeaponType: WeaponType | null,
  weaponRange: { max: number; min: number },
): AvailableAction | null {
  if (!isAbilityCompatibleWithEquippedWeapon(ability.id, equippedWeaponType)) {
    return null;
  }

  const definition = ABILITY_DEFINITIONS.get(ability.id);
  const requiresTarget = definition?.requiresTarget === true;
  const targetRange = getAbilityTargetRange(ability.id, weaponRange);
  const hasTargetInRange = !requiresTarget || hasVisibleEnemyTargetInRange(state, targetRange.max, targetRange.min);
  const hasEnoughMana = definition?.manaCost === undefined || state.player.mana >= definition.manaCost;
  const enabled = ability.cooldownRemaining === 0 && hasTargetInRange && hasEnoughMana;
  const abilityName = definition?.name ?? ability.id;

  return {
    id: `use_ability_${ability.id}`,
    label: buildAbilityLabel(abilityName, ability.cooldownRemaining, requiresTarget, hasTargetInRange),
    type: 'ability',
    enabled,
    description: definition?.description,
  };
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

    const npcActions = state.world.npcs
      .filter((npc) => npc.available)
      .map((npc) => ({
        id: `talk_${npc.id}`,
        label: `Talk to ${npc.name}`,
        type: 'town' as const,
        enabled: true,
        targetId: npc.id,
      }));
    actions = [...actions, ...npcActions];

    return actions;
  }

  if (state.phase === 'dungeon' && state.run !== null) {
    const movementActions: AvailableAction[] = [
      { id: 'move_n', label: 'Move North', type: 'move', enabled: true },
      { id: 'move_s', label: 'Move South', type: 'move', enabled: true },
      { id: 'move_e', label: 'Move East', type: 'move', enabled: true },
      { id: 'move_w', label: 'Move West', type: 'move', enabled: true },
    ];
    actions = [...actions, ...movementActions];

    const weaponRange = getEquippedWeaponRange(state);
    const equippedWeaponType = getEquippedWeaponType(state);

    const attackActions = Array.from(state.run.enemies.values())
      .filter((enemy) => {
        const distance = chebyshevDistance(state.player.position, enemy.position);
        if (distance > weaponRange.max || distance < weaponRange.min) {
          return false;
        }

        const cell = state.run?.floor.cells.get(posKey(enemy.position));
        return cell?.visibility === 'visible';
      })
      .map((enemy) => ({
        id: `attack_${enemy.id}`,
        label: chebyshevDistance(state.player.position, enemy.position) > 1
          ? `Shoot ${enemy.name}`
          : `Attack ${enemy.name}`,
        type: 'attack' as const,
        enabled: true,
        targetId: enemy.id,
      }));
    actions = [...actions, ...attackActions];

    actions = [...actions, { id: 'wait', label: 'Wait', type: 'wait', enabled: true }];

    if (canRetreat(state)) {
      actions = [...actions, { id: 'retreat', label: 'Retreat to Town', type: 'retreat', enabled: true }];
    }

    const playerCell = state.run.floor.cells.get(posKey(state.player.position));
    if (playerCell?.tile.type === 'stairs_up' && state.run.floorHistory.length > 0) {
      actions = [...actions, { id: 'ascend', label: 'Ascend (<)', type: 'ascend', enabled: true }];
    }

    if (state.player.equipment.weapon !== null || state.player.equipment.secondaryWeapon !== null) {
      actions = [...actions, { id: 'swap_weapons', label: 'Swap Weapon', type: 'swap', enabled: true }];
    }

    let objectActions: AvailableAction[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const position = { x: state.player.position.x + dx, y: state.player.position.y + dy };
        const key = posKey(position);
        const objectAtPosition = state.run.objects.get(key);
        if (objectAtPosition === undefined) {
          continue;
        }

        const template = OBJECT_TEMPLATES.get(objectAtPosition.templateId);
        objectActions = [...objectActions, {
          id: `interact_${key}`,
          label: template?.name ?? 'Interact',
          type: 'interact',
          enabled: true,
          targetPosition: position,
        }];
      }
    }
    actions = [...actions, ...objectActions];

    const abilityActions = (state.player.abilities ?? [])
      .map((ability) => buildAbilityAction(state, ability, equippedWeaponType, weaponRange))
      .filter((action): action is AvailableAction => action !== null);
    actions = [...actions, ...abilityActions];

    const itemActions = state.player.inventory.flatMap((itemId) => {
      const template = state.itemRegistry.items.get(itemId);
      if (template?.itemClass !== 'consumable') {
        return [];
      }

      return {
        id: `use_${itemId}`,
        label: `Use ${template.name}`,
        type: 'item' as const,
        enabled: true,
        targetId: itemId,
      };
    });
    actions = [...actions, ...itemActions];
  }

  return actions;
}
