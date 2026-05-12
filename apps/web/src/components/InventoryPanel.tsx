import React from 'react';
import type { InventoryItemView, InventoryView } from '@dungeon/presenter';
import { useGameStore } from '../store/game-store.js';
import { colors, FONT_STACK, btnStyle, btnEquipStyle, compactBtnStyle, compactBtnActiveStyle } from '../styles.js';
import { useInventoryFilter } from '../hooks/useInventoryFilter.js';
import { SectionLabel } from './ui/index.js';

function itemStatText(item: InventoryItemView): string {
  let text = '';
  if (item.weaponStats) {
    const ws = item.weaponStats;
    const dmg = `${ws.damageMin}–${ws.damageMax}`;
    text += `${dmg} ${ws.damageType} dmg`;
    if (ws.weaponRange && ws.weaponRange > 1) {
      text += ` | range: ${ws.weaponRange}`;
    }
  }
  if (item.armorStats) {
    text += `${item.armorStats.defense} def`;
    if (item.armorStats.evasionPenalty) {
      text += ` | eva penalty: -${item.armorStats.evasionPenalty}`;
    }
    if (item.armorStats.enchantmentDetails && item.armorStats.enchantmentDetails.length > 0) {
      const enchantmentNames = item.armorStats.enchantmentDetails
        .filter(detail => detail.enchantmentId !== null)
        .map(detail => detail.enchantmentName ?? detail.enchantmentId);
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
    <div
      style={{
        marginTop: 10,
        border: `1px solid ${colors.border}`,
        padding: 8,
        background: colors.panel,
        fontFamily: FONT_STACK,
      }}
    >
      <SectionLabel label="Inventory" />

      {gold !== undefined && (
        <div style={{ marginBottom: 6, color: colors.gold, fontSize: 11 }}>
          {gold}g
        </div>
      )}

      {/* Filter and sort controls */}
      <div style={{ fontSize: 10, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: colors.muted, marginRight: 2 }}>Filter:</span>
          {(['all', 'weapons', 'armor', 'consumables'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={filter === f ? compactBtnActiveStyle : compactBtnStyle}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: colors.muted, marginRight: 2 }}>Sort:</span>
          {(['name', 'rarity'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={sort === s ? compactBtnActiveStyle : compactBtnStyle}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {inventory.equipped.secondaryWeapon && (
          <button
            onClick={() => sendCommand({ type: 'SWAP_WEAPONS' })}
            style={{ ...compactBtnStyle, color: colors.gold, borderColor: '#4a380e' }}
            disabled={loading}
            title="Swap to secondary weapon"
          >
            Swap weapon
          </button>
        )}
      </div>

      {sorted.map((item, idx) => {
        const stats = itemStatText(item);
        const isEquipped = item.isEquipped;
        const quantity = item.quantity;
        const actionItemId = item.stackEntityIds[0] ?? item.id;

        let buttonContent: React.ReactNode = null;
        if (item.itemClass === 'weapon' || item.itemClass === 'armor') {
          if (!isEquipped) {
            buttonContent = (
              <button
                onClick={() => sendCommand({ type: 'EQUIP', itemId: actionItemId })}
                style={btnEquipStyle}
                disabled={loading}
              >
                Equip
              </button>
            );
          } else {
            buttonContent = (
              <button
                onClick={() => sendCommand({ type: 'UNEQUIP', itemId: actionItemId })}
                style={{ ...btnEquipStyle, color: colors.muted, borderColor: colors.border }}
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
              style={{ ...btnEquipStyle, color: colors.steel, borderColor: '#2a4a6a', background: '#0e1a2e' }}
              disabled={loading}
            >
              Use
            </button>
          );
        }

        if (phase === 'town') {
          buttonContent = (
            <button
              onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'shop_sell', targetId: actionItemId })}
              style={{ ...btnEquipStyle, color: colors.gold, borderColor: '#4a380e', background: '#1e1408' }}
              disabled={loading}
            >
              Sell {item.sellPrice}g
            </button>
          );
        }

        return (
          <div
            key={item.id}
            style={{
              fontSize: 11,
              color: colors.text,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '3px 0',
              borderBottom: idx < sorted.length - 1 ? `1px solid ${colors.border2}` : 'none',
            }}
          >
            {/* Index + action button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, flexShrink: 0 }}>
              <span style={{ color: colors.muted, width: 14, fontSize: 10 }}>{idx + 1}.</span>
              {buttonContent}
            </div>

            {/* Item info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: isEquipped ? colors.lime : colors.text }}>{item.name}</span>
                {quantity > 1 && (
                  <span style={{ color: colors.steel, fontSize: 10 }}>x{quantity}</span>
                )}
                {item.rarity && (
                  <span style={{ color: item.rarityColor, fontSize: 9 }}>[{item.rarity}]</span>
                )}
                {stats && (
                  <span style={{ color: colors.muted }}>{stats}</span>
                )}
                {isEquipped && (
                  <span style={{ color: colors.lime, fontSize: 10 }}>[equipped]</span>
                )}
              </div>
              {item.description && (
                <div style={{ color: colors.muted, fontSize: 10 }}>{item.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
