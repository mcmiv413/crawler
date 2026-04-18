/**
 * AbilityDropdown - Displays available abilities with target selection support.
 * For single-target abilities, shows both ability and target selection.
 * For directional abilities, shows direction selector after ability is clicked.
 */

import { useState } from 'react';
import type { AbilityView, EntityView } from '@dungeon/presenter';
import type { Direction } from '@dungeon/contracts';
import styles from './ActionDropdowns.module.css';

export interface AbilityDropdownProps {
  readonly abilities: readonly AbilityView[];
  readonly enemies: readonly EntityView[];
  readonly playerX: number;
  readonly playerY: number;
  readonly onSelect: (selection: { abilityId: string; targetId?: string; direction?: Direction }) => void;
}

function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function AbilityDropdown({
  abilities,
  enemies,
  playerX,
  playerY,
  onSelect,
}: AbilityDropdownProps) {
  const [selectedAbilityForDirection, setSelectedAbilityForDirection] = useState<string | null>(null);

  // Filter to ready abilities
  const readyAbilities = abilities.filter((a) => a.ready);

  if (readyAbilities.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No abilities available.</p>
      </div>
    );
  }

  // Check if any enemy is in reasonable range (assume max ability range ~5)
  const maxAbilityRange = 5;
  const enemiesInRange = enemies.filter((enemy) => {
    const distance = calculateDistance(playerX, playerY, enemy.x, enemy.y);
    return distance <= maxAbilityRange;
  });

  const handleAbilitySelect = (abilityId: string) => {
    const ability = abilities.find(a => a.id === abilityId);
    if (ability?.requiresDirection) {
      setSelectedAbilityForDirection(abilityId);
      return;
    }

    // If only one enemy in range, auto-target it
    if (enemiesInRange.length === 1) {
      const target = enemiesInRange[0];
      if (target) {
        onSelect({ abilityId, targetId: target.id });
      }
    } else if (enemiesInRange.length > 1) {
      // Multiple targets - user should select one
      // For now, just use first enemy in range
      const target = enemiesInRange[0];
      if (target) {
        onSelect({ abilityId, targetId: target.id });
      }
    } else {
      // No targets in range, still send ability (may be self-target)
      onSelect({ abilityId });
    }
  };

  const handleDirectionSelect = (direction: Direction) => {
    if (selectedAbilityForDirection) {
      const ability = abilities.find(a => a.id === selectedAbilityForDirection);
      if (ability?.id === 'dagger_set_trap' && enemiesInRange.length > 0) {
        onSelect({ abilityId: selectedAbilityForDirection, direction, targetId: enemiesInRange[0]?.id });
      } else {
        onSelect({ abilityId: selectedAbilityForDirection, direction });
      }
      setSelectedAbilityForDirection(null);
    }
  };

  // Show direction selector if a directional ability is selected
  if (selectedAbilityForDirection) {
    const selectedAbility = abilities.find(a => a.id === selectedAbilityForDirection);
    return (
      <div className={styles.listContainer}>
        <div style={{ marginBottom: '12px', padding: '8px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px 0' }}>Select direction for {selectedAbility?.name}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            <button
              onClick={() => handleDirectionSelect('NW')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ↖
            </button>
            <button
              onClick={() => handleDirectionSelect('N')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ↑
            </button>
            <button
              onClick={() => handleDirectionSelect('NE')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ↗
            </button>
            <button
              onClick={() => handleDirectionSelect('W')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ←
            </button>
            <button
              onClick={() => setSelectedAbilityForDirection(null)}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ✕
            </button>
            <button
              onClick={() => handleDirectionSelect('E')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              →
            </button>
            <button
              onClick={() => handleDirectionSelect('SW')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ↙
            </button>
            <button
              onClick={() => handleDirectionSelect('S')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ↓
            </button>
            <button
              onClick={() => handleDirectionSelect('SE')}
              style={{ padding: '4px', fontSize: '12px' }}
            >
              ↘
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {readyAbilities.map((ability) => {
        const cooldownStatus =
          ability.cooldownRemaining > 0
            ? `Cooldown: ${ability.cooldownRemaining} turn${ability.cooldownRemaining > 1 ? 's' : ''}`
            : 'Ready';

        // Disable button if ability requires target but no targets available
        const isDisabled = ability.requiresTarget && enemiesInRange.length === 0;
        const disabledReason = isDisabled ? 'No valid targets in range' : undefined;

        return (
          <button
            key={ability.id}
            className={`${styles.itemButton}`}
            onClick={() => handleAbilitySelect(ability.id)}
            disabled={isDisabled}
            title={disabledReason}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName}>{ability.name}</span>
              <span className={`${styles.badge} ${styles.ready}`}>{disabledReason ?? cooldownStatus}</span>
            </div>
            <div className={styles.itemDescription}>{ability.description}</div>
          </button>
        );
      })}
    </div>
  );
}
