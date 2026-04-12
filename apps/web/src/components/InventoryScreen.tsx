import React, { useState } from 'react';
import type { InventoryItemView, InventoryView } from '@dungeon/presenter';
import { btnStyle, rarityColor } from '../styles.js';
import { EquipmentDoll } from './EquipmentDoll.js';
import { ItemInspectModal } from './ItemInspectModal.js';
import { useInventoryFilter } from '../hooks/useInventoryFilter.js';

interface InventoryScreenProps {
  inventory: InventoryView;
  phase: string;
  sendCommand: (command: unknown) => void;
  onClose: () => void;
  gold?: number;
}

/**
 * Full-screen inventory view showing equipped items and carried inventory.
 */
export function InventoryScreen({
  inventory,
  phase,
  sendCommand,
  onClose,
  gold,
}: InventoryScreenProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItemView | null>(null);

  // Get non-equipped items for the bag
  const equippedIds = new Set<string>(
    Object.values(inventory.equipped)
      .filter((item): item is InventoryItemView => item !== null)
      .map((item) => item.id)
  );

  const bagItems = inventory.items.filter((item) => !equippedIds.has(item.id));

  // Use inventory filter hook for bag items
  const { filtered: sorted, filter, setFilter, sortBy, setSortBy } = useInventoryFilter(bagItems);

  // Helper to find the currently equipped item in a slot for comparison
  const getEquippedInSlot = (item: InventoryItemView): InventoryItemView | null => {
    if (item.weaponStats) {
      return inventory.equipped.weapon || null;
    }
    if (item.armorStats) {
      const slot = item.armorStats.slot;
      if (slot === 'chest') return inventory.equipped.chest;
      if (slot === 'head') return inventory.equipped.head;
      if (slot === 'gloves') return inventory.equipped.gloves;
      if (slot === 'boots') return inventory.equipped.boots;
      if (slot === 'ring') {
        return inventory.equipped.ring1 || inventory.equipped.ring2 || null;
      }
    }
    return null;
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#111',
        overflow: 'auto',
        padding: 16,
        fontFamily: 'monospace',
        color: '#ccc',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, color: '#cc8' }}>Inventory</h1>
          {gold !== undefined && <div style={{ color: '#cc8', fontSize: 11, marginTop: 4 }}>Gold: {gold}g</div>}
        </div>
        <button
          onClick={onClose}
          style={{
            ...btnStyle,
            fontSize: 12,
            padding: '6px 12px',
            background: '#1a2a3a',
            border: '1px solid #4a8',
            color: '#8cf',
            cursor: 'pointer',
            borderRadius: 2,
            whiteSpace: 'nowrap',
          }}
        >
          Back to Game
        </button>
      </div>

      {/* Equipment Section */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Equipment</h2>
        <EquipmentDoll
          equipped={inventory.equipped}
          onSlotClick={(item) => setSelectedItem(item)}
        />
      </div>

      {/* Bag Section */}
      {bagItems.length > 0 && (
        <div>
          <h2 style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Bag</h2>

          {/* Filter/Sort Controls */}
          <div style={{ fontSize: 10, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <div>
              Filter: {['all', 'weapons', 'armor', 'consumables'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  style={{
                    ...btnStyle,
                    fontSize: 9,
                    padding: '2px 6px',
                    marginLeft: 2,
                    background: filter === f ? '#2a4a2a' : '#2a2a2a',
                    color: filter === f ? '#4f4' : '#666',
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div>
              Sort: {['name', 'rarity'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s as any)}
                  style={{
                    ...btnStyle,
                    fontSize: 9,
                    padding: '2px 6px',
                    marginLeft: 2,
                    background: sortBy === s ? '#2a4a2a' : '#2a2a2a',
                    color: sortBy === s ? '#4f4' : '#666',
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            {sorted.map((item, idx) => {
              const quantity = item.quantity ?? 1;
              const isEquippable = item.itemClass !== 'consumable';
              return (
                <div
                  key={`${item.id}-${idx}`}
                  style={{
                    fontSize: 11,
                    color: '#aaa',
                    padding: 8,
                    marginBottom: 4,
                    border: '1px solid #333',
                    background: '#1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Clickable area for detail view */}
                  <div
                    onClick={() => setSelectedItem(item)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{idx + 1}.</span>
                    <span style={{ flex: 1 }}>
                      {item.name}
                      {quantity > 1 && <span style={{ color: '#8cf', fontSize: 10 }}> x{quantity}</span>}
                    </span>
                    <span style={{ color: rarityColor[item.rarity] ?? '#888', fontSize: 10 }}>
                      [{item.rarity}]
                    </span>
                  </div>

                  {/* Quick equip button */}
                  {isEquippable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendCommand({ type: 'EQUIP', itemId: item.stackEntityIds?.[0] ?? item.id });
                      }}
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        background: '#1a3a1a',
                        border: '1px solid #4f4',
                        color: '#4f4',
                        cursor: 'pointer',
                        borderRadius: 2,
                        marginLeft: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Equip
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Item Inspect Modal */}
      {selectedItem && (
        <ItemInspectModal
          item={selectedItem}
          equippedInSlot={getEquippedInSlot(selectedItem)}
          phase={phase}
          onClose={() => setSelectedItem(null)}
          sendCommand={sendCommand}
        />
      )}
    </div>
  );
}
