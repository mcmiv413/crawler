/**
 * SwapDropdown - Displays available weapons to swap to.
 */

import type { InventoryItemView } from '@dungeon/presenter';
import styles from './ActionDropdowns.module.css';
import { getRarityColor } from '../../utils/rarity-color.js';

export interface SwapDropdownProps {
  readonly weapons: readonly InventoryItemView[];
  readonly equippedWeaponId: string | null;
  readonly onSelect: (weaponId: string) => void;
}

export function SwapDropdown({
  weapons,
  equippedWeaponId,
  onSelect,
}: SwapDropdownProps) {
  if (weapons.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No other weapons available to swap.</p>
      </div>
    );
  }

  // Sort: equipped first, then by name
  const sortedWeapons = [...weapons].sort((a, b) => {
    if (a.id === equippedWeaponId) return -1;
    if (b.id === equippedWeaponId) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.listContainer}>
      {sortedWeapons.map((weapon) => {
        const isEquipped = weapon.id === equippedWeaponId;
        const rarityColor = getRarityColor(weapon.rarity);

        return (
          <button
            key={weapon.id}
            className={`${styles.itemButton} ${isEquipped ? styles.selected : ''}`}
            onClick={() => onSelect(weapon.id)}
            disabled={isEquipped}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName} style={{ color: rarityColor }}>
                {weapon.name}
              </span>
              {isEquipped && <span className={styles.badge}>EQUIPPED</span>}
            </div>
            <div className={styles.itemDescription}>{weapon.description}</div>
          </button>
        );
      })}
    </div>
  );
}
