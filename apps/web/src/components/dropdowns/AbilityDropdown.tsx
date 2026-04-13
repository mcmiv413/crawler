/**
 * AbilityDropdown - Displays available abilities to use.
 */

import type { AbilityView } from '@dungeon/presenter';
import styles from './ActionDropdowns.module.css';

export interface AbilityDropdownProps {
  readonly abilities: readonly AbilityView[];
  readonly onSelect: (abilityId: string) => void;
}

export function AbilityDropdown({ abilities, onSelect }: AbilityDropdownProps) {
  if (abilities.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No abilities available.</p>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {abilities.map((ability) => {
        const canUse = ability.ready;
        const cooldownStatus =
          ability.cooldownRemaining > 0
            ? `Cooldown: ${ability.cooldownRemaining} turn${ability.cooldownRemaining > 1 ? 's' : ''}`
            : 'Ready';

        return (
          <button
            key={ability.id}
            className={`${styles.itemButton} ${canUse ? '' : styles.disabled}`}
            onClick={() => {
              if (canUse) onSelect(ability.id);
            }}
            disabled={!canUse}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName}>{ability.name}</span>
              <span className={`${styles.badge} ${canUse ? styles.ready : styles.cooldown}`}>
                {cooldownStatus}
              </span>
            </div>
            <div className={styles.itemDescription}>{ability.description}</div>
          </button>
        );
      })}
    </div>
  );
}
