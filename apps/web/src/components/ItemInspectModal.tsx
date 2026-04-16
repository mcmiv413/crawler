import React from 'react';
import type { InventoryItemView, ShopItemView } from '@dungeon/presenter';
import { ITEM_MODAL_MAX_HEIGHT } from '../config/ui-config.js';
import { btnStyle } from '../styles.js';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';

interface ItemInspectModalProps {
  item: InventoryItemView | ShopItemView;
  equippedInSlot?: InventoryItemView | null;
  phase?: string;
  onClose: () => void;
  sendCommand: (command: unknown) => void;
  shopMode?: boolean;  // true = show Buy button, false/undefined = show Equip/Use/Sell
  shopPrice?: number;  // effectivePrice for buy mode
}

export function ItemInspectModal({
  item,
  equippedInSlot,
  phase,
  onClose,
  sendCommand,
  shopMode,
  shopPrice,
}: ItemInspectModalProps) {
  const isInventoryItem = 'id' in item;
  const isEquipped = isInventoryItem && equippedInSlot?.id === item.id;
  const showComparison = isInventoryItem && equippedInSlot && !isEquipped;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 200,
        }}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        style={{
          position: 'fixed',
          top: '10%',
          left: '10%',
          right: '10%',
          background: '#1a1a1a',
          border: '1px solid #555',
          padding: 20,
          overflow: 'auto',
          maxHeight: ITEM_MODAL_MAX_HEIGHT,
          zIndex: 201,
          fontFamily: 'monospace',
          color: '#ccc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: item.rarityColor }}>{item.name}</h2>
            <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{item.rarity}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              ...btnStyle,
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: '#888',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Description */}
        {item.description && (
          <div style={{ color: '#888', fontSize: 11, marginBottom: 12, lineHeight: 1.4 }}>
            {item.description}
          </div>
        )}

        {/* Value / Price */}
        <div style={{ fontSize: 11, marginBottom: 12, color: '#aaa' }}>
          {isInventoryItem && (
            <>
              <div>Value: {(item as InventoryItemView).value}g</div>
              <div>Sell Price: {(item as InventoryItemView).sellPrice}g</div>
            </>
          )}
          {shopMode && shopPrice !== undefined && (
            <div>Buy Price: {shopPrice}g</div>
          )}
        </div>

        {/* Weapon Stats */}
        {isInventoryItem && (item as InventoryItemView).weaponStats && (
          <div style={{ border: '1px solid #333', padding: 8, marginBottom: 12, background: '#111' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#cc8' }}>Weapon Stats</div>
            <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
              <div>Damage: {(item as InventoryItemView).weaponStats!.damage} {(item as InventoryItemView).weaponStats!.damageType}</div>
              <div>Accuracy: {(item as InventoryItemView).weaponStats!.accuracy}</div>
              <div>Speed: {(item as InventoryItemView).weaponStats!.speed}</div>
              <div>Range: {(item as InventoryItemView).weaponStats!.weaponRange}</div>
            </div>
          </div>
        )}

        {/* Armor Stats */}
        {isInventoryItem && (item as InventoryItemView).armorStats && (
          <div style={{ border: '1px solid #333', padding: 8, marginBottom: 12, background: '#111' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#8cf' }}>Armor Stats</div>
            <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
              <div>Defense: {(item as InventoryItemView).armorStats!.defense}</div>
              {(item as InventoryItemView).armorStats!.evasionPenalty > 0 && (
                <div>Evasion Penalty: {(item as InventoryItemView).armorStats!.evasionPenalty}</div>
              )}
              <div>Enchantment Slots: {(item as InventoryItemView).armorStats!.enchantmentSlots}</div>
              {(item as InventoryItemView).armorStats!.enchantments && (item as InventoryItemView).armorStats!.enchantments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  Enchantments:
                  {(item as InventoryItemView).armorStats!.enchantments.map((enchId, idx) => {
                    const enchDef = enchId ? ENCHANTMENT_BY_ID.get(enchId) : null;
                    const enchName = enchDef?.name ?? enchId ?? '[empty]';
                    const enchDesc = enchDef?.description ?? null;
                    return (
                      <div key={idx} style={{ marginLeft: 12, fontSize: 10, marginBottom: 4 }}>
                        <span style={{ color: enchId ? '#4af' : '#666' }}>Slot {idx + 1}: {enchName}</span>
                        {enchDesc && (
                          <span style={{ color: '#888', fontSize: 9, marginLeft: 6 }}>— {enchDesc}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparison Section */}
        {showComparison && equippedInSlot && isInventoryItem && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#fa4' }}>Comparison</div>
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Current Item */}
              <div style={{ flex: 1, border: '1px solid #444', padding: 8, background: '#0a0a0a' }}>
                <div style={{ fontSize: 11, color: '#aaa', fontWeight: 'bold', marginBottom: 8 }}>
                  {item.name}
                </div>
                {(item as InventoryItemView).weaponStats && (
                  <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
                    <div>DMG: {(item as InventoryItemView).weaponStats!.damage}</div>
                    <div>ACC: {(item as InventoryItemView).weaponStats!.accuracy}</div>
                    <div>SPD: {(item as InventoryItemView).weaponStats!.speed}</div>
                  </div>
                )}
                {(item as InventoryItemView).armorStats && (
                  <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
                    <div>DEF: {(item as InventoryItemView).armorStats!.defense}</div>
                  </div>
                )}
              </div>

              {/* Equipped Item */}
              <div style={{ flex: 1, border: '1px solid #444', padding: 8, background: '#0a0a0a' }}>
                <div style={{ fontSize: 11, color: '#4f4', fontWeight: 'bold', marginBottom: 8 }}>
                  {equippedInSlot.name} (equipped)
                </div>
                {equippedInSlot.weaponStats && (
                  <div style={{ fontSize: 10, color: '#4f4', lineHeight: 1.4 }}>
                    <div>DMG: {equippedInSlot.weaponStats.damage}</div>
                    <div>ACC: {equippedInSlot.weaponStats.accuracy}</div>
                    <div>SPD: {equippedInSlot.weaponStats.speed}</div>
                  </div>
                )}
                {equippedInSlot.armorStats && (
                  <div style={{ fontSize: 10, color: '#4f4', lineHeight: 1.4 }}>
                    <div>DEF: {equippedInSlot.armorStats.defense}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {shopMode && shopPrice !== undefined && !isInventoryItem && (
            <button
              onClick={() => {
                sendCommand({
                  type: 'TOWN_ACTION',
                  action: 'shop_buy',
                  itemId: (item as ShopItemView).itemId,
                });
                onClose();
              }}
              style={btnStyle}
            >
              Buy {shopPrice}g
            </button>
          )}

          {!shopMode && isInventoryItem && (item.itemClass === 'weapon' || item.itemClass === 'armor') && (
            <button
              onClick={() =>
                sendCommand({
                  type: isEquipped ? 'UNEQUIP' : 'EQUIP',
                  itemId: (item as InventoryItemView).id,
                })
              }
              style={btnStyle}
            >
              {isEquipped ? 'Unequip' : 'Equip'}
            </button>
          )}

          {!shopMode && isInventoryItem && item.itemClass === 'consumable' && (
            <button
              onClick={() => {
                sendCommand({
                  type: 'USE_ITEM',
                  itemId: (item as InventoryItemView).id,
                });
                onClose();
              }}
              style={btnStyle}
            >
              Use
            </button>
          )}

          {!shopMode && isInventoryItem && phase === 'town' && (
            <button
              onClick={() => {
                sendCommand({
                  type: 'TOWN_ACTION',
                  action: 'shop_sell',
                  targetId: (item as InventoryItemView).id,
                });
                onClose();
              }}
              style={{ ...btnStyle, color: '#cc8' }}
            >
              Sell {(item as InventoryItemView).sellPrice}g
            </button>
          )}
        </div>
      </div>
    </>
  );
}
