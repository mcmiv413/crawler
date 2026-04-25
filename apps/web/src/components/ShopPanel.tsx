import React, { useState } from 'react';
import type { GameView, ShopItemView, InventoryItemView } from '@dungeon/presenter';
import {
  btnStyle,
  btnStashStyle,
  colors,
  compactBtnActiveStyle,
  compactBtnStyle,
  FONT_STACK,
} from '../styles.js';
import { ItemInspectModal } from './ItemInspectModal.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { useInventoryFilter } from '../hooks/useInventoryFilter.js';
import { SectionLabel } from './ui/index.js';

interface ShopPanelProps {
  view: GameView;
  loading: boolean;
  sendCommand: (command: unknown) => Promise<void>;
  isMobile?: boolean;
}

type BuyFilter = 'all' | 'weapons' | 'armor' | 'consumables';
type SortKey = 'name' | 'rarity';

const BUY_FILTERS: ReadonlyArray<{ value: BuyFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'weapons', label: 'Weapons' },
  { value: 'armor', label: 'Armor' },
  { value: 'consumables', label: 'Consumables' },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'rarity', label: 'Rarity' },
];

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={value === opt.value ? compactBtnActiveStyle : compactBtnStyle}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ShopPanel({ view, loading, sendCommand }: ShopPanelProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [selectedItem, setSelectedItem] = useState<ShopItemView | InventoryItemView | null>(null);
  const [buyFilter, setBuyFilter] = useState<BuyFilter>('all');
  const [buySortBy, setBuySortBy] = useState<SortKey>('name');

  const shop = view.town?.shop;
  const unequippedItems = view.inventory.items.filter((item) => !item.isEquipped);
  const sellFiltered = useInventoryFilter(unequippedItems);

  if (!shop) return null;

  const headerStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: colors.gold,
    margin: 0,
    fontFamily: FONT_STACK,
  };

  const goldLineStyle: React.CSSProperties = {
    marginTop: 4,
    marginBottom: 10,
    color: colors.gold,
    fontSize: 11,
    fontFamily: FONT_STACK,
  };

  const modeToggle = (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
      <button
        onClick={() => setMode('buy')}
        style={mode === 'buy' ? compactBtnActiveStyle : compactBtnStyle}
      >
        Buy
      </button>
      <button
        onClick={() => setMode('sell')}
        style={mode === 'sell' ? compactBtnActiveStyle : compactBtnStyle}
      >
        Sell
      </button>
    </div>
  );

  // ── Buy mode ─────────────────────────────────────────────────────────────
  if (mode === 'buy') {
    const buyItems = shop.items
      .filter((item) => {
        if (buyFilter === 'all') return true;
        if (buyFilter === 'weapons') return item.itemClass === 'weapon';
        if (buyFilter === 'armor') return item.itemClass === 'armor';
        return item.itemClass === 'consumable';
      })
      .sort((a, b) => {
        if (buySortBy === 'name') return a.name.localeCompare(b.name);
        const rarityOrder: Record<string, number> = {
          common: 0,
          uncommon: 1,
          rare: 2,
          epic: 3,
          legendary: 4,
        };
        return (rarityOrder[b.rarity] ?? -1) - (rarityOrder[a.rarity] ?? -1);
      });

    return (
      <div style={{ fontFamily: FONT_STACK, color: colors.text }}>
        <h3 style={headerStyle}>Torben's Wares</h3>
        <div style={goldLineStyle}>Gold: {view.player.gold}g</div>
        {modeToggle}

        <SectionLabel label="Filter" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <FilterGroup options={BUY_FILTERS} value={buyFilter} onChange={setBuyFilter} />
          <FilterGroup options={SORT_OPTIONS} value={buySortBy} onChange={setBuySortBy} />
        </div>

        <SectionLabel label="Buy Items" marginTop={4} />
        <div style={{ fontSize: 11 }}>
          {buyItems.length === 0 ? (
            <div style={{ color: colors.muted }}>Nothing available.</div>
          ) : (
            buyItems.map((item: ShopItemView) => {
              const discounted = item.effectivePrice < item.price;
              const canAfford = view.player.gold >= item.effectivePrice;
              return (
                <div
                  key={item.itemId}
                  style={{
                    padding: '4px 0',
                    borderBottom: `1px solid ${colors.border2}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedItem(item)}
                >
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ItemSpriteIcon spriteName={item.spriteName} size={16} />
                    <span style={{ color: item.rarityColor, marginRight: 4 }}>[{item.rarity}]</span>
                    {item.name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      marginRight: 8,
                      minWidth: 100,
                    }}
                  >
                    <div style={{ color: colors.label, fontSize: 10, textAlign: 'right' }}>
                      {discounted ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: colors.muted }}>
                            {item.price}g
                          </span>{' '}
                          <span style={{ color: colors.lime }}>{item.effectivePrice}g</span>
                        </>
                      ) : (
                        <span style={{ color: colors.gold }}>{item.price}g</span>
                      )}
                    </div>
                    <div style={{ color: colors.muted, fontSize: 10, textAlign: 'right' }}>
                      ×{item.stock}
                    </div>
                    {item.weaponData && (
                      <div style={{ fontSize: 9, color: colors.steel }}>
                        <div>
                          Dmg: {item.weaponData.damageMin && item.weaponData.damageMax
                            ? `${item.weaponData.damageMin}-${item.weaponData.damageMax}`
                            : item.weaponData.damage} ({item.weaponData.damageType})
                        </div>
                        {item.weaponData.accuracy > 0 && <div>Acc: +{item.weaponData.accuracy}</div>}
                      </div>
                    )}
                    {item.armorData && (
                      <div style={{ fontSize: 9, color: colors.teal }}>
                        <div>Def: +{item.armorData.defense}</div>
                        {item.armorData.slot && <div>Slot: {item.armorData.slot}</div>}
                      </div>
                    )}
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
                    disabled={loading || !canAfford}
                  >
                    Buy
                  </button>
                </div>
              );
            })
          )}
        </div>

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

  // ── Sell mode ────────────────────────────────────────────────────────────
  const { filtered, filter, setFilter, sortBy, setSortBy } = sellFiltered;

  return (
    <div style={{ fontFamily: FONT_STACK, color: colors.text }}>
      <h3 style={headerStyle}>Sell Items</h3>
      <div style={goldLineStyle}>Gold: {view.player.gold}g</div>
      {modeToggle}

      <SectionLabel label="Filter" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        <FilterGroup options={BUY_FILTERS} value={filter as BuyFilter} onChange={setFilter as (v: BuyFilter) => void} />
        <FilterGroup options={SORT_OPTIONS} value={sortBy as SortKey} onChange={setSortBy as (v: SortKey) => void} />
      </div>

      {shop.canUndo && (
        <button
          onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'shop_undo' })}
          style={{ ...btnStashStyle, fontSize: 10, padding: '4px 8px', marginBottom: 10 }}
          disabled={loading}
        >
          ↶ Undo Last Transaction
        </button>
      )}

      <SectionLabel label="Sell Items" marginTop={4} />
      <div style={{ fontSize: 11 }}>
        {filtered.length === 0 ? (
          <div style={{ color: colors.muted }}>No items to sell.</div>
        ) : (
          filtered.map((item: InventoryItemView) => (
            <div
              key={item.id}
              style={{
                padding: '4px 0',
                borderBottom: `1px solid ${colors.border2}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                gap: 4,
              }}
              onClick={() => setSelectedItem(item)}
            >
              {item.spriteName && <ItemSpriteIcon spriteName={item.spriteName} size={16} />}
              <div style={{ flex: 1 }}>
                <span style={{ color: item.rarityColor, marginRight: 4 }}>[{item.rarity}]</span>
                {item.name}
                {item.quantity > 1 && (
                  <span style={{ color: colors.muted, marginLeft: 4 }}>×{item.quantity}</span>
                )}
              </div>
              <div style={{ marginRight: 8, color: colors.gold, fontSize: 10 }}>{item.sellPrice}g</div>
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
