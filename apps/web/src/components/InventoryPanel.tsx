import React from 'react';
import type { InventoryItemView, InventoryView } from '@dungeon/presenter';
import { useGameStore } from '../store/game-store.js';
import { btnStyle, rarityColor, compactBtnStyle } from '../styles.js';
import { useInventoryFilter } from '../hooks/useInventoryFilter.js';

function itemStatText(item: InventoryItemView): string {
  let text = '';
  if (item.weaponStats) {
    text += `${item.weaponStats.damage} ${item.weaponStats.damageType} dmg`;
    if (item.weaponStats.weaponRange && item.weaponStats.weaponRange > 1) {
      text += ` | Range: ${item.weaponStats.weaponRange}`;
    }
  }
  if (item.armorStats) {
    text += `${item.armorStats.defense} def`;
    if (item.armorStats.evasionPenalty) {
      text += ` | eva penalty: -${item.armorStats.evasionPenalty}`;
    }
    if (item.armorStats.enchantments && item.armorStats.enchantments.length > 0) {
      const enchantmentNames = item.armorStats.enchantments.filter((e): e is string => e !== null);
      if (enchantmentNames.length > 0) {
        text += ` | enchant: ${enchantmentNames.join(', ')}`;
      }
    }
  }
  return text;
}

interface InventoryPanelProps {
  inventory: InventoryView;
  phase?: string;
  gold?: number;
}

export function InventoryPanel({ inventory, phase, gold }: InventoryPanelProps) {
  const { sendCommand, loading } = useGameStore();
  const { filtered: sorted, filter, setFilter, sortBy: sort, setSortBy: setSort } = useInventoryFilter(inventory.items);

  if (inventory.items.length === 0) return null;

  return (
    <div style={{ marginTop: 10, border: '1px solid #333', padding: 5, background: '#1a1a1a' }}>
      <h4 style={{ margin: 0, color: '#888' }}>Inventory</h4>
      {gold !== undefined && <div style={{ marginBottom: 6, color: '#cc8', fontSize: 11 }}>Gold: {gold}g</div>}
      {/* C4: Filter and sort controls */}
      <div style={{ fontSize: 10, marginBottom: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          Filter: {['all', 'weapons', 'armor', 'consumables'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              style={{
                ...compactBtnStyle,
                background: filter === f ? '#2a4a2a' : '#2a2a2a',
                color: filter === f ? '#4f4' : '#666',
              }}
              title={f.charAt(0).toUpperCase() + f.slice(1)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          Sort: {['name', 'rarity'].map(s => (
            <button
              key={s}
              onClick={() => setSort(s as any)}
              style={{
                ...compactBtnStyle,
                background: sort === s ? '#2a4a2a' : '#2a2a2a',
                color: sort === s ? '#4f4' : '#666',
              }}
              title={s.charAt(0).toUpperCase() + s.slice(1)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {inventory.equipped.secondaryWeapon && (
          <button
            onClick={() => sendCommand({ type: 'SWAP_WEAPONS' })}
            style={{
              ...compactBtnStyle,
              color: '#fc3',
            }}
            disabled={loading}
            title="Swap to secondary weapon"
          >
            ⚔ Swap
          </button>
        )}
      </div>
      {sorted.map((item, idx) => {
        const stats = itemStatText(item);
        const isEquipped = item.isEquipped ?? false;
        const quantity = item.quantity ?? 1;
        const actionItemId = item.stackEntityIds?.[0] ?? item.id;

        // C3: Button layout to the left
        let buttonContent: React.ReactNode = null;
        if (item.itemClass === 'weapon' || item.itemClass === 'armor') {
          if (!isEquipped) {
            buttonContent = (
              <button
                onClick={() => sendCommand({ type: 'EQUIP', itemId: actionItemId })}
                style={{ ...btnStyle, fontSize: 10, padding: '1px 6px', width: 50 }}
                disabled={loading}
              >
                Equip
              </button>
            );
          } else {
            buttonContent = (
              <button
                onClick={() => sendCommand({ type: 'UNEQUIP', itemId: actionItemId })}
                style={{ ...btnStyle, fontSize: 10, padding: '1px 6px', width: 50 }}
                disabled={loading}
              >
                Unequip
              </button>
            );
          }
        } else if (item.itemClass === 'consumable' && !isEquipped) {
          buttonContent = (
            <button
              onClick={() => sendCommand({ type: 'USE_ITEM', itemId: actionItemId })}
              style={{ ...btnStyle, fontSize: 10, padding: '1px 6px', width: 50 }}
              disabled={loading}
            >
              Use
            </button>
          );
        }

        if (phase === 'town' && item.sellPrice !== undefined) {
          buttonContent = (
            <button
              onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'shop_sell', targetId: actionItemId })}
              style={{ ...btnStyle, fontSize: 10, padding: '1px 6px', color: '#cc8', width: 70 }}
              disabled={loading}
            >
              Sell {item.sellPrice}g
            </button>
          );
        }

        return (
          <div key={`${item.id}-${idx}`} style={{ fontSize: 11, color: '#aaa', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0' }}>
            {/* Left: index and button column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ color: '#666', width: 14 }}>{idx + 1}.</span>
              {buttonContent}
            </div>

            {/* Right: item info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{item.name}</span>
                {quantity > 1 && <span style={{ color: '#8cf', fontSize: 10 }}>x{quantity}</span>}
                {item.rarity && <span style={{ color: rarityColor[item.rarity] ?? '#aaa', fontSize: 9 }}>[{item.rarity}]</span>}
                {stats && <span style={{ color: '#888' }}>({stats})</span>}
                {isEquipped && (
                  <span style={{ color: '#4f4', fontSize: 10 }}>[Equipped]</span>
                )}
              </div>
              {item.description && <span style={{ color: '#666', fontSize: 10 }}>{item.description}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
