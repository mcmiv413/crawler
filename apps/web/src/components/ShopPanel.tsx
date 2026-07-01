import React, { useState } from 'react';
import type { GameView, ShopItemView, InventoryItemView } from '@dungeon/presenter';
import {
  btnStyle,
  btnStashStyle,
  colors,
  compactBtnActiveStyle,
  compactBtnStyle,
  FONT_STACK,
  fontSize,
} from '../styles.js';
import { ItemInspectModal } from './ItemInspectModal.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import {
  INVENTORY_FILTER_OPTIONS,
  INVENTORY_SORT_OPTIONS,
  filterInventoryItems,
  sortInventoryItems,
  useInventoryFilter,
  type InventoryFilterType,
  type InventorySortType,
} from '../hooks/useInventoryFilter.js';
import { SectionLabel } from './ui/index.js';

interface ShopPanelProps {
  view: GameView;
  loading: boolean;
  sendCommand: (command: unknown) => Promise<void>;
  isMobile?: boolean;
}

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

export function ShopPanel({ view, loading, sendCommand, isMobile = false }: ShopPanelProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [selectedItem, setSelectedItem] = useState<ShopItemView | InventoryItemView | null>(null);
  const [buyFilter, setBuyFilter] = useState<InventoryFilterType>('all');
  const [buySortBy, setBuySortBy] = useState<InventorySortType>('name');
  const [flashItemId, setFlashItemId] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string>('');
  const [toastKey, setToastKey] = useState(0);

  const shop = view.town?.shop;
  const unequippedItems = view.inventory.items.filter((item) => !item.isEquipped);
  const sellFiltered = useInventoryFilter(unequippedItems);

  if (!shop) return null;

  // Inject keyframe CSS for purchase animations
  const SHOP_ANIM_ID = 'shop-feedback-keyframes';
  if (typeof document !== 'undefined' && !document.getElementById(SHOP_ANIM_ID)) {
    const s = document.createElement('style');
    s.id = SHOP_ANIM_ID;
    s.textContent = `
      @keyframes purchaseFlash {
        0%,60% { opacity:1 }
        100%   { opacity:0 }
      }
      @keyframes toastIn {
        0%        { opacity:0; transform:translateY(4px) }
        12%,70%   { opacity:1; transform:translateY(0) }
        100%      { opacity:0; transform:translateY(-3px) }
      }
    `;
    document.head.appendChild(s);
  }

  const headerStyle: React.CSSProperties = {
    fontSize: fontSize.panelTitle,
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
    fontSize: fontSize.meta,
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
    const buyItems = sortInventoryItems(filterInventoryItems(shop.items, buyFilter), buySortBy);

    return (
      <div style={{ fontFamily: FONT_STACK, color: colors.text, position: 'relative' }}>
        <h3 style={headerStyle}>Torben's Wares</h3>
        <div style={goldLineStyle}>Gold: {view.player.gold}g</div>
        {modeToggle}

        <SectionLabel label="Filter" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          <FilterGroup options={INVENTORY_FILTER_OPTIONS} value={buyFilter} onChange={setBuyFilter} />
          <FilterGroup options={INVENTORY_SORT_OPTIONS} value={buySortBy} onChange={setBuySortBy} />
        </div>

        <SectionLabel label="Buy Items" marginTop={4} />
        <div style={{ fontSize: fontSize.body }}>
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
                    padding: isMobile ? 8 : '6px 0',
                    paddingLeft: isMobile ? 8 : (canAfford ? 6 : 0),
                    border: isMobile
                      ? `1px solid ${canAfford ? 'rgba(125,201,64,0.2)' : colors.border2}`
                      : undefined,
                    borderBottom: isMobile
                      ? undefined
                      : (canAfford
                          ? `1px solid rgba(125,201,64,0.12)`
                          : `1px solid ${colors.border2}`),
                    borderRadius: isMobile ? 4 : undefined,
                    marginBottom: isMobile ? 8 : 0,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'flex-start',
                    gap: isMobile ? 6 : 8,
                    cursor: 'pointer',
                    background: canAfford ? 'rgba(125,201,64,0.04)' : 'transparent',
                    boxShadow: canAfford ? 'inset 2px 0 0 rgba(125,201,64,0.35)' : 'none',
                    opacity: canAfford ? 1 : 0.5,
                    position: 'relative',
                    transition: 'background 0.15s ease, opacity 0.15s ease',
                  }}
                  onClick={() => setSelectedItem(item)}
                >
                  {/* flash overlay for purchase feedback */}
                  {flashItemId === item.itemId && (
                    <div
                      key={toastKey}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(125,201,64,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        animation: 'purchaseFlash 0.85s ease-out forwards',
                        zIndex: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.1em',
                          color: colors.lime,
                          background: 'rgba(13,13,16,0.85)',
                          padding: '2px 10px',
                          border: `1px solid rgba(125,201,64,0.4)`,
                        }}
                      >
                        ✓ Purchased
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                      minWidth: 0,
                      fontSize: isMobile ? fontSize.body : undefined,
                    }}
                  >
                    <ItemSpriteIcon spriteName={item.spriteName} size={16} />
                    <span style={{ color: item.rarityColor, marginRight: 4 }}>[{item.rarity}]</span>
                    {item.name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'row' : 'column',
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                      alignItems: isMobile ? 'center' : 'flex-end',
                      gap: isMobile ? 8 : 2,
                      marginRight: isMobile ? 0 : 8,
                      minWidth: 'auto',
                      textAlign: isMobile ? 'left' : 'right',
                    }}
                  >
                    <div style={{ color: colors.label, fontSize: fontSize.micro, fontWeight: 600 }}>
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
                    <div style={{ color: colors.muted, fontSize: fontSize.micro }}>
                      ×{item.stock}
                    </div>
                    {item.weaponData && (
                      <div style={{ fontSize: fontSize.micro, color: colors.steel }}>
                        <div>
                          Dmg: {item.weaponData.damageMin && item.weaponData.damageMax
                            ? `${item.weaponData.damageMin}-${item.weaponData.damageMax}`
                            : item.weaponData.damage} ({item.weaponData.damageType})
                        </div>
                        {item.weaponData.accuracy > 0 && <div>Acc: +{item.weaponData.accuracy}</div>}
                      </div>
                    )}
                    {item.armorData && (
                      <div style={{ fontSize: fontSize.micro, color: colors.teal }}>
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
                      // purchase feedback
                      setFlashItemId(item.itemId);
                      setToastText('✓ Purchased');
                      setToastKey((k) => k + 1);
                      setTimeout(() => setFlashItemId(null), 900);
                    }}
                    style={{
                      ...btnStyle,
                      fontSize: fontSize.micro,
                      padding: isMobile ? '6px 10px' : '4px 8px',
                      whiteSpace: 'nowrap',
                      alignSelf: isMobile ? 'flex-start' : undefined,
                    }}
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

        {/* panel toast for purchase feedback */}
        {toastText && (
          <div
            key={toastKey}
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              background: 'rgba(13,13,16,0.92)',
              border: '1px solid rgba(125,201,64,0.45)',
              color: colors.lime,
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 12px',
              letterSpacing: '0.06em',
              pointerEvents: 'none',
              animation: 'toastIn 0.9s ease-out forwards',
              zIndex: 10,
            }}
          >
            {toastText}
          </div>
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
        <FilterGroup options={INVENTORY_FILTER_OPTIONS} value={filter} onChange={setFilter} />
        <FilterGroup options={INVENTORY_SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
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
      <div style={{ fontSize: isMobile ? fontSize.body : 11 }}>
        {filtered.length === 0 ? (
          <div style={{ color: colors.muted }}>No items to sell.</div>
        ) : (
          filtered.map((item: InventoryItemView) => (
            <div
              key={item.id}
              style={{
                padding: isMobile ? 8 : '4px 0',
                border: isMobile ? `1px solid ${colors.border2}` : undefined,
                borderBottom: isMobile ? undefined : `1px solid ${colors.border2}`,
                borderRadius: isMobile ? 4 : undefined,
                marginBottom: isMobile ? 8 : 0,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                cursor: 'pointer',
                gap: isMobile ? 6 : 4,
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
              <div style={{ marginRight: isMobile ? 0 : 8, color: colors.gold, fontSize: isMobile ? fontSize.micro : 10 }}>{item.sellPrice}g</div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sendCommand({
                    type: 'TOWN_ACTION',
                    action: 'shop_sell',
                    targetId: item.id,
                  });
                }}
                style={{
                  ...btnStyle,
                  fontSize: isMobile ? fontSize.micro : 9,
                  padding: isMobile ? '6px 10px' : '2px 6px',
                  alignSelf: isMobile ? 'flex-start' : undefined,
                }}
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
