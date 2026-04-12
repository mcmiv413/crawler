import React, { useState } from 'react';
import type { GameView, ShopItemView, InventoryItemView } from '@dungeon/presenter';
import { btnStyle, rarityColor } from '../styles.js';
import { ItemInspectModal } from './ItemInspectModal.js';
import { useInventoryFilter } from '../hooks/useInventoryFilter.js';

interface ShopPanelProps {
  view: GameView;
  loading: boolean;
  sendCommand: (command: unknown) => Promise<void>;
  isMobile?: boolean;
}

export function ShopPanel({ view, loading, sendCommand, isMobile }: ShopPanelProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [selectedItem, setSelectedItem] = useState<ShopItemView | InventoryItemView | null>(null);
  const [buyFilter, setBuyFilter] = useState<'all' | 'weapons' | 'armor' | 'consumables'>('all');
  const [buySortBy, setBuySortBy] = useState<'name' | 'rarity'>('name');

  // Initialize sell filter hook at top level
  const shop = view.town?.shop;
  const sellFiltered = useInventoryFilter(view.inventory.items);

  if (!shop) return null;

  // Filter and sort shop items for buy mode
  const buyItems = shop.items
    .filter(item => {
      if (buyFilter === 'all') return true;
      if (buyFilter === 'weapons') return item.itemClass === 'weapon';
      if (buyFilter === 'armor') return item.itemClass === 'armor';
      return item.itemClass === 'consumable';
    })
    .sort((a, b) => {
      if (buySortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      const rarityOrder: Record<string, number> = { 'common': 0, 'uncommon': 1, 'rare': 2, 'epic': 3, 'legendary': 4 };
      const rarityA = rarityOrder[a.rarity] ?? -1;
      const rarityB = rarityOrder[b.rarity] ?? -1;
      return rarityB - rarityA;
    });

  // Buy mode: shop items
  if (mode === 'buy') {
    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ color: '#cc8844', margin: 0 }}>Torben's Wares</h3>
          <div style={{ marginBottom: 8, color: '#cc8', fontSize: 11 }}>Gold: {view.player.gold}g</div>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button
              onClick={() => setMode('buy')}
              style={{
                ...btnStyle,
                fontSize: 11,
                padding: '4px 8px',
                background: '#444',
                color: '#4af',
              }}
            >
              Buy
            </button>
            <button
              onClick={() => setMode('sell')}
              style={{
                ...btnStyle,
                fontSize: 11,
                padding: '4px 8px',
                background: '#222',
                color: '#888',
              }}
            >
              Sell
            </button>
          </div>

          {/* Filter/Sort */}
          <div style={{ display: 'flex', gap: 4, fontSize: 11, marginBottom: 8, flexWrap: 'wrap' }}>
            <select
              value={buyFilter}
              onChange={(e) => setBuyFilter(e.target.value as any)}
              style={{
                padding: '2px 4px',
                background: '#222',
                color: '#aaa',
                border: '1px solid #333',
                fontSize: 10,
              }}
            >
              <option value="all">All Items</option>
              <option value="weapons">Weapons</option>
              <option value="armor">Armor</option>
              <option value="consumables">Consumables</option>
            </select>
            <select
              value={buySortBy}
              onChange={(e) => setBuySortBy(e.target.value as any)}
              style={{
                padding: '2px 4px',
                background: '#222',
                color: '#aaa',
                border: '1px solid #333',
                fontSize: 10,
              }}
            >
              <option value="name">Sort by Name</option>
              <option value="rarity">Sort by Rarity</option>
            </select>
          </div>
        </div>

        {/* Items List */}
        <div style={{ fontSize: 11 }}>
          {buyItems.length === 0 ? (
            <div style={{ color: '#666' }}>Nothing available.</div>
          ) : (
            buyItems.map((item: ShopItemView) => {
              const discounted = item.effectivePrice < item.price;
              return (
                <div
                  key={item.itemId}
                  style={{
                    padding: '4px 0',
                    borderBottom: '1px solid #222',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedItem(item)}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ color: rarityColor[item.rarity] ?? '#aaa', marginRight: 4 }}>
                      [{item.rarity}]
                    </span>
                    {item.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginRight: 8 }}>
                    <div style={{ color: '#888', fontSize: 10, minWidth: 50, textAlign: 'right' }}>
                      {discounted ? (
                        <>
                          <span style={{ textDecoration: 'line-through' }}>{item.price}g</span>{' '}
                          <span style={{ color: '#4f4' }}>{item.effectivePrice}g</span>
                        </>
                      ) : (
                        <span>{item.price}g</span>
                      )}
                    </div>
                    <div style={{ color: '#666', fontSize: 10, minWidth: 30, textAlign: 'right' }}>
                      ×{item.stock}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sendCommand({
                        type: 'TOWN_ACTION',
                        action: 'shop_buy',
                        itemId: item.itemId,
                      });
                    }}
                    style={{ ...btnStyle, fontSize: 9, padding: '2px 6px' }}
                    disabled={loading || view.player.gold < item.effectivePrice}
                  >
                    Buy
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Item Inspect Modal */}
        {selectedItem && 'itemId' in selectedItem && (
          <ItemInspectModal
            item={selectedItem}
            phase="town"
            onClose={() => setSelectedItem(null)}
            sendCommand={sendCommand}
            shopMode={true}
            shopPrice={(selectedItem as ShopItemView).effectivePrice}
          />
        )}
      </div>
    );
  }

  // Sell mode: inventory items
  const { filtered, filter, setFilter, sortBy, setSortBy } = sellFiltered;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ color: '#cc8844', margin: 0 }}>Sell Items</h3>
        <div style={{ marginBottom: 8, color: '#cc8', fontSize: 11 }}>Gold: {view.player.gold}g</div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button
            onClick={() => setMode('buy')}
            style={{
              ...btnStyle,
              fontSize: 11,
              padding: '4px 8px',
              background: '#222',
              color: '#888',
            }}
          >
            Buy
          </button>
          <button
            onClick={() => setMode('sell')}
            style={{
              ...btnStyle,
              fontSize: 11,
              padding: '4px 8px',
              background: '#444',
              color: '#4af',
            }}
          >
            Sell
          </button>
        </div>

        {/* Filter/Sort */}
        <div style={{ display: 'flex', gap: 4, fontSize: 11, marginBottom: 8, flexWrap: 'wrap' }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            style={{
              padding: '2px 4px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              fontSize: 10,
            }}
          >
            <option value="all">All Items</option>
            <option value="weapons">Weapons</option>
            <option value="armor">Armor</option>
            <option value="consumables">Consumables</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '2px 4px',
              background: '#222',
              color: '#aaa',
              border: '1px solid #333',
              fontSize: 10,
            }}
          >
            <option value="name">Sort by Name</option>
            <option value="rarity">Sort by Rarity</option>
          </select>
        </div>

        {/* Undo Button */}
        {shop.canUndo && (
          <button
            onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'shop_undo' })}
            style={{ ...btnStyle, fontSize: 10, padding: '4px 8px', marginBottom: 8, color: '#fa4' }}
            disabled={loading}
          >
            ↶ Undo Last Transaction
          </button>
        )}
      </div>

      {/* Items List */}
      <div style={{ fontSize: 11 }}>
        {filtered.length === 0 ? (
          <div style={{ color: '#666' }}>No items to sell.</div>
        ) : (
          filtered.map((item: InventoryItemView) => (
            <div
              key={item.id}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid #222',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedItem(item)}
            >
              <div style={{ flex: 1 }}>
                <span style={{ color: rarityColor[item.rarity] ?? '#aaa', marginRight: 4 }}>
                  [{item.rarity}]
                </span>
                {item.name}
                {item.quantity > 1 && <span style={{ color: '#666', marginLeft: 4 }}>×{item.quantity}</span>}
              </div>
              <div style={{ marginRight: 8, color: '#888', fontSize: 10 }}>{item.sellPrice}g</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sendCommand({
                    type: 'TOWN_ACTION',
                    action: 'shop_sell',
                    targetId: item.id,
                  });
                }}
                style={{ ...btnStyle, fontSize: 9, padding: '2px 6px' }}
                disabled={loading}
              >
                Sell
              </button>
            </div>
          ))
        )}
      </div>

      {/* Item Inspect Modal */}
      {selectedItem && 'id' in selectedItem && (
        <ItemInspectModal
          item={selectedItem}
          equippedInSlot={view.inventory.equipped.weapon === selectedItem ? selectedItem : null}
          phase="town"
          onClose={() => setSelectedItem(null)}
          sendCommand={sendCommand}
          shopMode={false}
        />
      )}
    </div>
  );
}
