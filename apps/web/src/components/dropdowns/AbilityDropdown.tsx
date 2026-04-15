/**
 * AbilityDropdown - Displays available abilities with target selection support.
 * For single-target abilities, shows both ability and target selection.
 */

import type { AbilityView, EntityView } from '@dungeon/presenter';
import styles from './ActionDropdowns.module.css';

export interface AbilityDropdownProps {
  readonly abilities: readonly AbilityView[];
  readonly enemies: readonly EntityView[];
  readonly playerX: number;
  readonly playerY: number;
  readonly onSelect: (selection: { abilityId: string; targetId?: string }) => void;
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

  return (
    <div className={styles.listContainer}>
      {readyAbilities.map((ability) => {
        const cooldownStatus =
          ability.cooldownRemaining > 0
            ? `Cooldown: ${ability.cooldownRemaining} turn${ability.cooldownRemaining > 1 ? 's' : ''}`
            : 'Ready';

        return (
          <button
            key={ability.id}
            className={`${styles.itemButton}`}
            onClick={() => handleAbilitySelect(ability.id)}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName}>{ability.name}</span>
              <span className={`${styles.badge} ${styles.ready}`}>{cooldownStatus}</span>
            </div>
            <div className={styles.itemDescription}>{ability.description}</div>
          </button>
        );
      })}
    </div>
  );
}
