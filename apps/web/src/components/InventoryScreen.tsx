import React, { useState } from 'react';
import type { InventoryItemView, InventoryView, DismissibleNotice } from '@dungeon/presenter';
import { btnStyle, compactBtnStyle, colors } from '../styles.js';
import { EquipmentDoll } from './EquipmentDoll.js';
import { ItemInspectModal } from './ItemInspectModal.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { DismissibleNoticeModal } from './ui/DismissibleNoticeModal.js';
import { useInventoryFilter } from '../hooks/useInventoryFilter.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';
import { getItemStats } from '../utils/item-stats.js';

interface InventoryScreenProps {
  inventory: InventoryView;
  phase: string;
  sendCommand: (command: unknown) => void;
  onClose: () => void;
  gold?: number;
  notice?: DismissibleNotice;
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
  notice,
}: InventoryScreenProps) {
  const { isMobile } = useBreakpoint();
  const [selectedItem, setSelectedItem] = useState<InventoryItemView | null>(null);
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<Set<string>>(new Set());
  const [bagExpanded, setBagExpanded] = useState(false);

  const handleDismissNotice = (noticeId: string) => {
    setDismissedNoticeIds(prev => new Set(prev).add(noticeId));
  };

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
    return Object.values(inventory.equipped).find(
      (e): e is InventoryItemView => e !== null && e.id === item.id
    ) ?? null;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#111',
        padding: 16,
        fontFamily: 'monospace',
        color: '#ccc',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Header - always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0 }}>
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
            flexShrink: 0,
          }}
        >
          Back to Game
        </button>
      </div>

      {/* Equipment Section */}
      {!bagExpanded && (
        <div style={{ marginBottom: 24, flexShrink: 0 }}>
          <h2 style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Equipment</h2>
          <EquipmentDoll
            equipped={inventory.equipped}
            onSlotClick={(item) => setSelectedItem(item)}
          />
        </div>
      )}

      {/* Bag Section - scrolls internally */}
      {bagItems.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexShrink: 0 }}>
            <h2 style={{ fontSize: 14, color: '#888', margin: 0 }}>Bag</h2>
            <button
              type="button"
              aria-expanded={bagExpanded}
              data-testid="inventory-bag-toggle"
              onClick={() => setBagExpanded(expanded => !expanded)}
              style={{
                ...compactBtnStyle,
                background: bagExpanded ? '#2a2a2a' : '#1a2a3a',
                border: '1px solid #4a8',
                color: '#8cf',
                whiteSpace: 'nowrap',
                minHeight: 28,
              }}
              title={bagExpanded ? 'Collapse inventory list' : 'Expand inventory list'}
            >
              {bagExpanded ? 'Collapse list' : 'Expand list'}
            </button>
          </div>

          {/* Filter/Sort Controls - always visible */}
          <div style={{ fontSize: 10, marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              Filter: {['all', 'weapons', 'armor', 'consumables'].map((f) => (
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
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              Sort: {['name', 'rarity'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s as any)}
                  style={{
                    ...compactBtnStyle,
                    background: sortBy === s ? '#2a4a2a' : '#2a2a2a',
                    color: sortBy === s ? '#4f4' : '#666',
                  }}
                  title={s.charAt(0).toUpperCase() + s.slice(1)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Item list - scrolls internally */}
          <div
            data-testid="inventory-item-list"
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              paddingBottom: isMobile ? TAB_BAR_HEIGHT : 0,
            }}
          >
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
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{idx + 1}.</span>
                    <ItemSpriteIcon spriteName={item.spriteName} size={16} />
                    <span>
                      {item.name}
                      {quantity > 1 && <span style={{ color: '#8cf', fontSize: 10 }}> x{quantity}</span>}
                    </span>
                    <span style={{ color: item.rarityColor, fontSize: 10 }}>
                      [{item.rarity}]
                    </span>
                    {(() => {
                      const stats = getItemStats(item);
                      return stats ? <span style={{ color: colors.muted, fontSize: 10 }}>{stats}</span> : null;
                    })()}
                  </div>

                  {/* Quick equip button */}
                  {isEquippable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendCommand({ type: 'EQUIP', itemId: item.stackEntityIds?.[0] ?? item.id });
                      }}
                      style={{
                        ...compactBtnStyle,
                        background: '#1a3a1a',
                        border: '1px solid #4f4',
                        color: '#4f4',
                        whiteSpace: 'nowrap',
                        padding: '2px 6px',
                      }}
                      title="Equip this item"
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

      {/* Dismissible Notice Modal */}
      <DismissibleNoticeModal
        notice={notice}
        dismissedNoticeIds={dismissedNoticeIds}
        onDismiss={handleDismissNotice}
        title="Equipment Blocked"
        accentColor="#fa0"
      />
    </div>
  );
}
