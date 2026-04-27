/**
 * UnifiedActionPanel - Master component for displaying all player actions.
 * Replaces ActionButtonGrid + ConsumablesBar.
 * Rendering logic orchestrates 7 main action buttons + contextual overlays/modals.
 * When on stairs: shows STAIRS button with Ascend/Retreat dropdown.
 */

import { useReducer } from 'react';
import type { Direction, GameCommand } from '@dungeon/contracts';
import type { GameView } from '@dungeon/presenter';
import type { ActionButtonType } from '../config/action-icons';
import { ACTION_ORDER } from '../config/action-icons';
import { SPRITE_NAMES } from '../config/sprite-names';
import { ActionButton } from './ActionButton';
import { ItemSpriteIcon } from './ItemSpriteIcon';
import { AttackDropdown } from './dropdowns/AttackDropdown';
import { AbilityDropdown } from './dropdowns/AbilityDropdown';
import { InteractDropdown } from './dropdowns/InteractDropdown';
import { UseDropdown } from './dropdowns/UseDropdown';
import { StairsDropdown } from './dropdowns/StairsDropdown';
import styles from './UnifiedActionPanel.module.css';

export interface UnifiedActionPanelProps {
  readonly view: GameView;
  readonly onSendCommand: (command: GameCommand) => void;
  readonly onInspectOpen?: () => void;
}

interface DropdownState {
  readonly active: ActionButtonType | 'STAIRS' | null;
}

type DropdownAction =
  | { type: 'OPEN'; payload: ActionButtonType | 'STAIRS' }
  | { type: 'CLOSE' };

function dropdownReducer(
  state: DropdownState,
  action: DropdownAction,
): DropdownState {
  switch (action.type) {
    case 'OPEN':
      return { active: action.payload };
    case 'CLOSE':
      return { active: null };
  }
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function UnifiedActionPanel({
  view,
  onSendCommand,
  onInspectOpen,
}: UnifiedActionPanelProps) {
  const [dropdown, dispatchDropdown] = useReducer(dropdownReducer, {
    active: null,
  });

  const mapEntities = view.map?.entities ?? [];
  const enemies = mapEntities.filter((entity) => entity.type === 'enemy');
  const objects = mapEntities.filter((entity) => entity.type === 'object');
  const playerPos = view.map?.playerPosition ?? { x: 0, y: 0 };
  const weaponRange = view.inventory.equipped.weapon?.weaponStats?.weaponRange ?? 1;
  const minRange = view.inventory.equipped.weapon?.weaponStats?.minRange ?? 0;
  const consumablesWithQty = view.inventory.items
    .filter((item) => item.itemClass === 'consumable')
    .map((item) => ({
      ...item,
      quantity: item.quantity ?? 0,
    }));

  const handleActionClick = (actionType: ActionButtonType | 'STAIRS') => {
    switch (actionType) {
      case 'WAIT':
        onSendCommand({ type: 'WAIT' });
        break;
      case 'SWAP':
        onSendCommand({ type: 'SWAP_WEAPONS' });
        break;
      case 'STAIRS':
        if (dropdown.active === 'STAIRS') {
          dispatchDropdown({ type: 'CLOSE' });
        } else {
          dispatchDropdown({ type: 'OPEN', payload: 'STAIRS' });
        }
        break;
      case 'ATTACK': {
        const inRangeEnemies = enemies.filter((enemy) => {
          const distance = calculateDistance(playerPos.x, playerPos.y, enemy.x, enemy.y);
          return distance <= weaponRange && distance >= minRange;
        });

        if (inRangeEnemies.length === 1) {
          const enemy = inRangeEnemies[0];
          if (enemy !== undefined) {
            onSendCommand({ type: 'ATTACK', targetId: enemy.id });
          }
          break;
        }

        if (dropdown.active === actionType) {
          dispatchDropdown({ type: 'CLOSE' });
        } else {
          dispatchDropdown({ type: 'OPEN', payload: actionType });
        }
        break;
      }
      case 'INSPECT':
        onInspectOpen?.();
        break;
      default:
        if (dropdown.active === actionType) {
          dispatchDropdown({ type: 'CLOSE' });
        } else {
          dispatchDropdown({ type: 'OPEN', payload: actionType });
        }
    }
  };

  const handleDropdownSelect = (actionType: ActionButtonType, selection: unknown) => {
    switch (actionType) {
      case 'ATTACK':
        onSendCommand({ type: 'ATTACK', targetId: selection as string });
        break;
      case 'ABILITY': {
        const abilitySelection = selection as {
          abilityId: string;
          targetId?: string;
          direction?: Direction;
          itemEntityId?: string;
        };
        if (abilitySelection.itemEntityId !== undefined) {
          onSendCommand({
            type: 'SET_TRAP',
            direction: abilitySelection.direction!,
            itemEntityId: abilitySelection.itemEntityId,
          });
        } else {
          onSendCommand({
            type: 'USE_ABILITY',
            abilityId: abilitySelection.abilityId,
            targetId: abilitySelection.targetId,
            direction: abilitySelection.direction,
          });
        }
        break;
      }
      case 'INTERACT': {
        const objectId = selection as string;
        const objectEntity = view.map?.entities.find((entity) => entity.id === objectId);
        if (objectEntity !== undefined) {
          onSendCommand({
            type: 'INTERACT',
            targetPosition: { x: objectEntity.x, y: objectEntity.y },
          });
        }
        break;
      }
      case 'USE':
        onSendCommand({ type: 'USE_ITEM', itemId: selection as string });
        break;
      case 'INSPECT':
        break;
      default:
        break;
    }

    dispatchDropdown({ type: 'CLOSE' });
  };

  const isOnStairs = (): boolean => {
    if (view.map === null) return false;

    const playerCell = view.map.cells.find(
      (cell) => cell.x === view.map!.playerPosition.x && cell.y === view.map!.playerPosition.y,
    );
    return playerCell?.tileType === 'stairs_up';
  };

  const canReturnToTown = (): boolean => {
    if (view.map === null) return false;

    const playerCell = view.map.cells.find(
      (cell) => cell.x === view.map!.playerPosition.x && cell.y === view.map!.playerPosition.y,
    );
    if (playerCell === undefined) return false;

    return playerCell.tileType === 'stairs_up' || (playerCell.x === 0 && playerCell.y === 0);
  };

  const isActionEnabled = (actionType: ActionButtonType): boolean => {
    switch (actionType) {
      case 'WAIT':
        return true;
      case 'ATTACK':
        return enemies.some((enemy) => {
          const distance = calculateDistance(playerPos.x, playerPos.y, enemy.x, enemy.y);
          return distance <= weaponRange && distance >= minRange;
        });
      case 'SWAP':
        return view.inventory.equipped.weapon !== null || view.inventory.equipped.secondaryWeapon !== null;
      case 'ABILITY':
        return view.player.abilities.length > 0;
      case 'INTERACT':
        return objects.length > 0;
      case 'USE':
        return consumablesWithQty.some((item) => item.quantity > 0);
      case 'INSPECT':
        return view.inspectableEntities.length > 0;
      default:
        return false;
    }
  };

  const getActionLabel = (actionType: ActionButtonType): string => {
    switch (actionType) {
      case 'WAIT':
        return 'Wait';
      case 'ATTACK':
        return 'Attack';
      case 'SWAP':
        return 'Swap';
      case 'ABILITY':
        return 'Ability';
      case 'INTERACT':
        return 'Interact';
      case 'USE':
        return 'Use';
      case 'INSPECT':
        return 'Inspect';
      default:
        return actionType;
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.grid}>
        {ACTION_ORDER.map((actionType) => (
          <ActionButton
            key={actionType}
            type={actionType}
            label={getActionLabel(actionType)}
            enabled={isActionEnabled(actionType)}
            isActive={dropdown.active === actionType}
            onClick={() => handleActionClick(actionType)}
          />
        ))}

        {isOnStairs() && (
          <ActionButton
            key="STAIRS"
            type="INTERACT"
            label="Stairs"
            enabled={true}
            isActive={dropdown.active === 'STAIRS'}
            onClick={() => handleActionClick('STAIRS')}
            iconElement={<ItemSpriteIcon spriteName={SPRITE_NAMES.STAIRS_UP} size={16} />}
          />
        )}
      </div>

      {dropdown.active !== null && (
        <div className={styles.dropdownContainer} role="dialog" aria-modal="true">
          <div className={styles.dropdownContent}>
            {dropdown.active === 'ATTACK' && (
              <AttackDropdown
                enemies={enemies}
                inspectableEntities={view.inspectableEntities}
                playerX={playerPos.x}
                playerY={playerPos.y}
                weaponRange={weaponRange}
                minRange={minRange}
                onSelect={(enemyId) => handleDropdownSelect('ATTACK', enemyId)}
              />
            )}

            {dropdown.active === 'ABILITY' && (
              <AbilityDropdown
                abilities={view.player.abilities}
                enemies={enemies}
                inventory={view.inventory.items}
                playerX={playerPos.x}
                playerY={playerPos.y}
                mapObjects={objects}
                mapCells={view.map?.cells}
                onSelect={(abilitySelection) => handleDropdownSelect('ABILITY', abilitySelection)}
              />
            )}

            {dropdown.active === 'INTERACT' && (
              <InteractDropdown
                objects={objects}
                playerX={playerPos.x}
                playerY={playerPos.y}
                onSelect={(objectId) => handleDropdownSelect('INTERACT', objectId)}
              />
            )}

            {dropdown.active === 'USE' && (
              <UseDropdown
                consumables={consumablesWithQty}
                onSelect={(itemId) => handleDropdownSelect('USE', itemId)}
              />
            )}

            {dropdown.active === 'STAIRS' && (
              <StairsDropdown
                canAscend={isOnStairs()}
                canRetreat={canReturnToTown()}
                onAscend={() => {
                  onSendCommand({ type: 'ASCEND' });
                  dispatchDropdown({ type: 'CLOSE' });
                }}
                onRetreat={() => {
                  onSendCommand({ type: 'RETREAT' });
                  dispatchDropdown({ type: 'CLOSE' });
                }}
              />
            )}
          </div>

          <button className={styles.cancelButton} onClick={() => dispatchDropdown({ type: 'CLOSE' })}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
