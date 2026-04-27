/**
 * AbilityDropdown - Displays available abilities with target and direction support.
 */

import { useMemo, useState } from 'react';
import type { AbilityView, EntityView, InventoryItemView } from '@dungeon/presenter';
import { getValidDisarmableTraps, getValidEnemyTargets, getValidTrapPlacementDirections } from '@dungeon/presenter/targeting';
import type { Direction } from '@dungeon/contracts';
import styles from './ActionDropdowns.module.css';

type AbilitySelection = {
  abilityId: string;
  targetId?: string;
  direction?: Direction;
  itemEntityId?: string;
};

type MapCellLike = {
  readonly x: number;
  readonly y: number;
  readonly walkable: boolean;
};

const DIRECTION_BUTTONS: ReadonlyArray<{ readonly direction: Direction; readonly label: string }> = [
  { direction: 'NW', label: '↖' },
  { direction: 'N', label: '↑' },
  { direction: 'NE', label: '↗' },
  { direction: 'W', label: '←' },
  { direction: 'E', label: '→' },
  { direction: 'SW', label: '↙' },
  { direction: 'S', label: '↓' },
  { direction: 'SE', label: '↘' },
];

export interface AbilityDropdownProps {
  readonly abilities: readonly AbilityView[];
  readonly enemies: readonly EntityView[];
  readonly inventory: readonly InventoryItemView[];
  readonly playerX: number;
  readonly playerY: number;
  readonly mapObjects?: readonly EntityView[];
  readonly mapCells?: readonly MapCellLike[];
  readonly onSelect: (selection: AbilitySelection) => void;
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function calculateDirection(
  playerX: number,
  playerY: number,
  targetX: number,
  targetY: number,
): Direction {
  const dx = targetX - playerX;
  const dy = targetY - playerY;

  if (dy < 0) {
    if (dx < 0) return 'NW';
    if (dx === 0) return 'N';
    return 'NE';
  }

  if (dy === 0) {
    if (dx < 0) return 'W';
    return 'E';
  }

  if (dx < 0) return 'SW';
  if (dx === 0) return 'S';
  return 'SE';
}

function getTrapEntityId(item: InventoryItemView): string | null {
  return item.stackEntityIds[0] ?? null;
}

export function AbilityDropdown({
  abilities,
  enemies,
  inventory,
  playerX,
  playerY,
  mapObjects = [],
  mapCells,
  onSelect,
}: AbilityDropdownProps) {
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [selectedTrapItemId, setSelectedTrapItemId] = useState<string | null>(null);
  const playerPosition = { x: playerX, y: playerY };

  const trapItems = useMemo(
    () => inventory.filter((item) => item.itemClass === 'trap'),
    [inventory],
  );

  const disarmableTraps = useMemo(
    () => getValidDisarmableTraps(playerPosition, mapObjects),
    [mapObjects, playerX, playerY],
  );

  const targetableEnemies = useMemo(() => {
    const inRangeEnemies = getValidEnemyTargets(enemies, playerPosition);
    return inRangeEnemies.length > 0 ? inRangeEnemies : enemies;
  }, [enemies, playerX, playerY]);

  const validTrapPlacementDirections = useMemo(() => {
    const mutableDirections = new Set<Direction>();
    const placements = getValidTrapPlacementDirections(playerPosition, mapObjects, enemies, mapCells);

    for (const placement of placements) {
      mutableDirections.add(calculateDirection(playerX, playerY, placement.x, placement.y));
    }

    return mutableDirections;
  }, [enemies, mapCells, mapObjects, playerX, playerY]);

  const resetSelection = () => {
    setSelectedAbilityId(null);
    setSelectedTrapItemId(null);
  };

  const handleAbilitySelect = (ability: AbilityView) => {
    if (ability.ready !== true) {
      return;
    }

    if (ability.id === 'dagger_disarm') {
      if (disarmableTraps.length === 1) {
        const trap = disarmableTraps[0]!;
        onSelect({
          abilityId: ability.id,
          direction: calculateDirection(playerX, playerY, trap.x, trap.y),
        });
        return;
      }

      setSelectedAbilityId(ability.id);
      return;
    }

    if (ability.id === 'dagger_set_trap' || ability.requiresDirection === true) {
      setSelectedAbilityId(ability.id);
      return;
    }

    if (ability.requiresTarget === true) {
      const target = targetableEnemies[0];
      if (target !== undefined) {
        onSelect({ abilityId: ability.id, targetId: target.id });
        return;
      }
    }

    onSelect({ abilityId: ability.id });
  };

  const handleDirectionSelect = (direction: Direction) => {
    if (selectedAbilityId === null) {
      return;
    }

    if (selectedAbilityId === 'dagger_set_trap') {
      if (selectedTrapItemId === null) {
        return;
      }

      onSelect({
        abilityId: selectedAbilityId,
        direction,
        itemEntityId: selectedTrapItemId,
      });
      resetSelection();
      return;
    }

    onSelect({ abilityId: selectedAbilityId, direction });
    resetSelection();
  };

  if (abilities.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No abilities available.</p>
      </div>
    );
  }

  if (selectedAbilityId === 'dagger_disarm') {
    if (disarmableTraps.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div>
            <p>No disarmable traps nearby.</p>
            <button className={styles.itemButton} onClick={resetSelection}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.listContainer}>
        {disarmableTraps.map((trap) => {
          const distance = calculateDistance(playerX, playerY, trap.x, trap.y);
          return (
            <button
              key={trap.id}
              className={styles.itemButton}
              onClick={() => {
                onSelect({
                  abilityId: 'dagger_disarm',
                  direction: calculateDirection(playerX, playerY, trap.x, trap.y),
                });
                resetSelection();
              }}
            >
              <div className={styles.itemHeader}>
                <span className={styles.itemName}>{trap.name}</span>
                <span className={styles.badge}>{distance} away</span>
              </div>
              <div className={styles.itemDescription}>Disarm the selected trap.</div>
            </button>
          );
        })}
        <button className={styles.itemButton} onClick={resetSelection}>
          Cancel
        </button>
      </div>
    );
  }

  if (selectedAbilityId === 'dagger_set_trap' && selectedTrapItemId === null) {
    if (trapItems.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div>
            <p>No traps in inventory.</p>
            <button className={styles.itemButton} onClick={resetSelection}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.listContainer}>
        {trapItems.map((item) => {
          const trapEntityId = getTrapEntityId(item);
          return (
            <button
              key={item.id}
              className={styles.itemButton}
              onClick={() => {
                if (trapEntityId !== null) {
                  setSelectedTrapItemId(trapEntityId);
                }
              }}
            >
              <div className={styles.itemHeader}>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.quantity}>×{item.quantity ?? 0}</span>
              </div>
              <div className={styles.itemDescription}>{item.description}</div>
            </button>
          );
        })}
        <button className={styles.itemButton} onClick={resetSelection}>
          Cancel
        </button>
      </div>
    );
  }

  if (selectedAbilityId !== null) {
    const selectedAbility = abilities.find((ability) => ability.id === selectedAbilityId);
    const isSetTrap = selectedAbilityId === 'dagger_set_trap';

    return (
      <div className={styles.listContainer}>
        <div className={styles.itemButton}>
          <div className={styles.itemHeader}>
            <span className={styles.itemName}>
              {isSetTrap ? 'Select trap placement direction' : `Select direction for ${selectedAbility?.name ?? selectedAbilityId}`}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {DIRECTION_BUTTONS.map(({ direction, label }) => {
              const isDisabled = isSetTrap && validTrapPlacementDirections.size > 0 && !validTrapPlacementDirections.has(direction);
              return (
                <button
                  key={direction}
                  className={`${styles.itemButton} ${isDisabled ? styles.disabled : ''}`}
                  disabled={isDisabled}
                  onClick={() => handleDirectionSelect(direction)}
                  style={{ alignItems: 'center', textAlign: 'center' }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button className={styles.itemButton} onClick={resetSelection}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {abilities.map((ability) => {
        const cooldownStatus = ability.cooldownRemaining > 0
          ? `Cooldown: ${ability.cooldownRemaining} turn${ability.cooldownRemaining === 1 ? '' : 's'}`
          : 'Ready';
        const disabledReason = ability.cooldownRemaining > 0
          ? cooldownStatus
          : ability.id === 'dagger_disarm'
            ? (disarmableTraps.length === 0 ? 'No adjacent traps' : undefined)
            : ability.id === 'dagger_set_trap'
              ? (trapItems.length === 0 ? 'No traps in inventory' : undefined)
              : ability.requiresTarget
                ? (targetableEnemies.length === 0 ? 'No valid targets' : undefined)
                : undefined;
        const isDisabled = disabledReason !== undefined && disabledReason !== 'Ready';

        return (
          <button
            key={ability.id}
            className={`${styles.itemButton} ${isDisabled ? styles.disabled : ''}`}
            disabled={isDisabled}
            onClick={() => handleAbilitySelect(ability)}
            title={disabledReason}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName}>{ability.name}</span>
              <span className={`${styles.badge} ${ability.cooldownRemaining > 0 ? styles.cooldown : styles.ready}`}>
                {disabledReason ?? cooldownStatus}
              </span>
            </div>
            <div className={styles.itemDescription}>{ability.description}</div>
          </button>
        );
      })}
    </div>
  );
}
