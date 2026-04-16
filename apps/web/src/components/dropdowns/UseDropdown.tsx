/**
 * UseDropdown - Displays available consumable items to use.
 */

import type { InventoryItemView } from '@dungeon/presenter';
import styles from './ActionDropdowns.module.css';

export interface UseDropdownProps {
  readonly consumables: readonly (InventoryItemView & { readonly quantity: number })[];
  readonly onSelect: (itemId: string) => void;
}

export function UseDropdown({
  consumables,
  onSelect,
}: UseDropdownProps) {
  if (consumables.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No consumable items available.</p>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      {consumables.map((item) => {
        const isAvailable = item.quantity > 0;

        return (
          <button
            key={item.id}
            className={`${styles.itemButton} ${!isAvailable ? styles.disabled : ''}`}
            onClick={() => {
              if (isAvailable) onSelect(item.id);
            }}
            disabled={!isAvailable}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName} style={{ color: item.rarityColor }}>
                {item.name}
              </span>
              <span className={styles.quantity}>
                ×{item.quantity}
              </span>
            </div>
            <div className={styles.itemDescription}>{item.description}</div>
            {!isAvailable && (
              <div className={styles.unavailable}>Out of stock</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
