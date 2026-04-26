/**
 * UnifiedActionPanel - Master component for displaying all player actions.
 * Replaces ActionButtonGrid + ConsumablesBar.
 * Rendering logic orchestrates 7 main action buttons + contextual overlays/modals.
 * When on stairs: shows STAIRS button with Ascend/Retreat dropdown.
 */

import { useReducer } from 'react';
import type { GameCommand, Direction } from '@dungeon/contracts';
import type {
  AvailableAction,
  EntityView,
  InventoryItemView,
  AbilityView,
  GameView,
} from '@dungeon/presenter';
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

  const handleActionClick = (actionType: ActionButtonType | 'STAIRS') => {
    switch (actionType) {
      case 'WAIT':
        onSendCommand({ type: 'WAIT' });
        break;
      case 'SWAP':
        // SWAP_WEAPONS toggles between main and secondary weapon (no parameters)
        onSendCommand({ type: 'SWAP_WEAPONS' });
        break;
      case 'STAIRS':
        // Toggle stairs dropdown
        if (dropdown.active === 'STAIRS') {
          dispatchDropdown({ type: 'CLOSE' });
        } else {
          dispatchDropdown({ type: 'OPEN', payload: 'STAIRS' });
        }
        break;
      case 'ATTACK': {
        // Auto-attack if only 1 enemy in range, otherwise show dropdown
        const inRangeEnemies = enemies.filter((enemy) => {
          const distance = calculateDistance(playerPos.x, playerPos.y, enemy.x, enemy.y);
          return distance <= weaponRange && distance >= minRange;
        });

        if (inRangeEnemies.length === 1) {
          // Auto-attack the single enemy
          const enemy = inRangeEnemies[0];
          if (enemy) {
            onSendCommand({ type: 'ATTACK', targetId: enemy.id });
          }
        } else {
          // Show dropdown to choose target
          if (dropdown.active === actionType) {
            dispatchDropdown({ type: 'CLOSE' });
          } else {
            dispatchDropdown({ type: 'OPEN', payload: actionType });
          }
        }
        break;
      }
      case 'INSPECT':
        // Open inspect modal
        if (onInspectOpen) onInspectOpen();
        break;
      default:
        // Toggle dropdown for actions requiring selection
        if (dropdown.active === actionType) {
          dispatchDropdown({ type: 'CLOSE' });
        } else {
          dispatchDropdown({ type: 'OPEN', payload: actionType });
        }
    }
  };

  const handleDropdownSelect = (actionType: ActionButtonType, selection: unknown) => {
    switch (actionType) {
      case 'ATTACK': {
        const enemyId = selection as string;
        onSendCommand({ type: 'ATTACK', targetId: enemyId });
        break;
      }
      case 'ABILITY': {
        const abilitySelection = selection as { abilityId: string; targetId?: string; direction?: Direction };
        onSendCommand({
          type: 'USE_ABILITY',
          abilityId: abilitySelection.abilityId,
          targetId: abilitySelection.targetId,
          direction: abilitySelection.direction,
        });
        break;
      }
      case 'INTERACT': {
        const objectId = selection as string;
        // Find the object in the map to get its position
        const mapEntity = view.map?.entities.find((e) => e.id === objectId);
        if (mapEntity) {
          onSendCommand({
            type: 'INTERACT',
            targetPosition: { x: mapEntity.x, y: mapEntity.y },
          });
        }
        break;
      }
      case 'USE': {
        const itemId = selection as string;
        onSendCommand({ type: 'USE_ITEM', itemId });
        break;
      }
      case 'INSPECT': {
        // Inspect dropdown selection just closes the dropdown
        // The entity inspection view is handled via GameView in DungeonPhase
        break;
      }
      default:
        break;
    }
    dispatchDropdown({ type: 'CLOSE' });
  };

  const mapEntities = view.map?.entities ?? [];
  const enemies = mapEntities.filter((e) => e.type === 'enemy');
  const objects = mapEntities.filter((e) => e.type === 'object');
  const playerPos = view.map?.playerPosition ?? { x: 0, y: 0 };

  // Get weapon range from equipped weapon (including minRange for ranged weapons)
  const weaponRange = view.inventory.equipped.weapon?.weaponStats?.weaponRange ?? 1;
  const minRange = view.inventory.equipped.weapon?.weaponStats?.minRange ?? 0;

  // Prepare consumables with quantity information
  const consumablesWithQty = view.inventory.items
    .filter((item) => item.itemClass === 'consumable')
    .map((item) => ({
      ...item,
      quantity: item.quantity ?? 0,
    }));

  // Helper: detect if player is on stairs_up (can ascend)
  const isOnStairs = (): boolean => {
    if (!view.map) return false;
    const playerCell = view.map.cells.find(
      (cell) =>
        cell.x === view.map!.playerPosition.x && cell.y === view.map!.playerPosition.y,
    );
    return playerCell?.tileType === 'stairs_up';
  };

  // Helper: detect if player is at entrance or on stairs (can retreat)
  const canReturnToTown = (): boolean => {
    if (!view.map) return false;
    const playerCell = view.map.cells.find(
      (cell) =>
        cell.x === view.map!.playerPosition.x && cell.y === view.map!.playerPosition.y,
    );
    if (!playerCell) return false;
    return (
      playerCell.tileType === 'stairs_up' ||
      (playerCell.x === 0 && playerCell.y === 0) // Entrance is typically at 0,0
    );
  };

  const isActionEnabled = (actionType: ActionButtonType): boolean => {
    switch (actionType) {
      case 'WAIT':
        return true;
      case 'ATTACK': {
        // Only enabled if enemies are in weapon range
        return enemies.some((enemy) => {
          const distance = calculateDistance(playerPos.x, playerPos.y, enemy.x, enemy.y);
          return distance <= weaponRange && distance >= minRange;
        });
      }
      case 'SWAP':
        return !!view.inventory.equipped.weapon; // allows swap-to-unarmed
      case 'ABILITY':
        return view.player.abilities.some((a) => a.ready);
      case 'INTERACT':
        return objects.length > 0;
      case 'USE':
        return consumablesWithQty.some((item) => item.quantity > 0);
      case 'INSPECT':
        return true;
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

        {/* Conditional STAIRS button when on stairs */}
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

      {/* Inline dropdowns rendered below buttons */}
      {dropdown.active && (
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
                playerX={playerPos.x}
                playerY={playerPos.y}
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

          {/* Cancel button to close dropdown */}
          <button className={styles.cancelButton} onClick={() => dispatchDropdown({ type: 'CLOSE' })}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
