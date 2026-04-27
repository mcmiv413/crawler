import React from 'react';
import type { InventoryItemView, ShopItemView } from '@dungeon/presenter';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';
import { Z_INSPECT } from '../config/ui-config.js';
import { btnStyle, colors, modalCardStyle } from '../styles.js';
import { ModalBackdrop, SectionLabel, InfoCard } from './ui/index.js';

interface ItemInspectModalProps {
  item: InventoryItemView | ShopItemView;
  equippedInSlot?: InventoryItemView | null;
  phase?: string;
  onClose: () => void;
  sendCommand: (command: unknown) => void;
  shopMode?: boolean;
  shopPrice?: number;
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
    <ModalBackdrop onClose={onClose} zIndex={Z_INSPECT}>
      <div
        style={{ ...modalCardStyle, maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rarity-themed header (name colour = rarity) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            padding: '10px 14px 8px',
            borderBottom: `1px solid ${colors.border}`,
            background: colors.inset,
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: item.rarityColor, fontSize: 15, fontWeight: 600 }}>
              {item.name}
            </h2>
            <div style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{item.rarity}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              padding: '2px 6px',
              background: 'transparent',
              border: 'none',
              color: colors.muted,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {item.description && (
            <div style={{ color: colors.label, fontSize: 11, marginBottom: 12, lineHeight: 1.4 }}>
              {item.description}
            </div>
          )}

          <div style={{ fontSize: 11, marginBottom: 12, color: colors.text }}>
            {isInventoryItem && (
              <>
                <div>Value: {(item as InventoryItemView).value}g</div>
                <div>Sell Price: {(item as InventoryItemView).sellPrice}g</div>
              </>
            )}
            {shopMode && shopPrice !== undefined && <div>Buy Price: {shopPrice}g</div>}
          </div>

          {isInventoryItem && (item as InventoryItemView).weaponStats && (
            <InfoCard marginBottom={12}>
              <SectionLabel label="Weapon Stats" color={colors.gold} />
              <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.6 }}>
                <div>
                  Damage: {(() => {
                    const ws = (item as InventoryItemView).weaponStats!;
                    const dmg = ws.damageMin != null ? `${ws.damageMin}–${ws.damageMax}` : `${ws.damage}`;
                    return `${dmg} ${ws.damageType}`;
                  })()} 
                </div>
                <div>Accuracy: {(item as InventoryItemView).weaponStats!.accuracy}</div>
                <div>Speed: {(item as InventoryItemView).weaponStats!.speed}</div>
                <div>Range: {(item as InventoryItemView).weaponStats!.weaponRange}</div>
                {(item as InventoryItemView).weaponStats!.weaponRange > 1 && (
                  <div style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>–10% acc per tile</div>
                )}
                {(item as InventoryItemView).weaponStats!.onHitStatus && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${colors.border2}`, fontSize: 10, color: colors.teal }}>
                    On hit: {(item as InventoryItemView).weaponStats!.onHitStatus}
                    {(item as InventoryItemView).weaponStats!.onHitChance !== undefined && (
                      <span> ({(item as InventoryItemView).weaponStats!.onHitChance}% chance)</span>
                    )}
                  </div>
                )}
              </div>
            </InfoCard>
          )}

          {isInventoryItem && (item as InventoryItemView).armorStats && (
            <InfoCard marginBottom={12}>
              <SectionLabel label="Armor Stats" color={colors.steel} />
              <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.6 }}>
                <div>Defense: {(item as InventoryItemView).armorStats!.defense}</div>
                {(item as InventoryItemView).armorStats!.evasionPenalty > 0 && (
                  <div>Evasion Penalty: {(item as InventoryItemView).armorStats!.evasionPenalty}</div>
                )}
                <div>Enchantment Slots: {(item as InventoryItemView).armorStats!.enchantmentSlots}</div>
                {(item as InventoryItemView).armorStats!.enchantments &&
                  (item as InventoryItemView).armorStats!.enchantments.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      Enchantments:
                      {(item as InventoryItemView).armorStats!.enchantments.map((enchId, idx) => {
                        const enchDef = enchId ? ENCHANTMENT_BY_ID.get(enchId) : null;
                        const enchName = enchDef?.name ?? enchId ?? '[empty]';
                        const enchDesc = enchDef?.description ?? null;
                        return (
                          <div key={idx} style={{ marginLeft: 12, fontSize: 10, marginBottom: 4 }}>
                            <span style={{ color: enchId ? colors.teal : colors.muted }}>
                              Slot {idx + 1}: {enchName}
                            </span>
                            {enchDesc && (
                              <span style={{ color: colors.muted, fontSize: 9, marginLeft: 6 }}>
                                — {enchDesc}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            </InfoCard>
          )}

          {isInventoryItem && (item as InventoryItemView).itemClass === 'consumable' && (item as any).consumable?.effect === 'buff' && (
            <InfoCard marginBottom={12}>
              <SectionLabel label="Effect" color={colors.teal} />
              <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.6 }}>
                <div>
                  +{(item as any).consumable.magnitude} attack · ~{(item as any).consumable.duration} turns
                </div>
              </div>
            </InfoCard>
          )}

          {showComparison && equippedInSlot && isInventoryItem && (
            <div style={{ marginBottom: 12 }}>
              <SectionLabel label="Comparison" color={colors.gold} />
              <div style={{ display: 'flex', gap: 12 }}>
                <InfoCard style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: colors.text, fontWeight: 600, marginBottom: 8 }}>
                    {item.name}
                  </div>
                  {(item as InventoryItemView).weaponStats && (
                    <div style={{ fontSize: 10, color: colors.text, lineHeight: 1.4 }}>
                      <div>DMG: {(item as InventoryItemView).weaponStats!.damage}</div>
                      <div>ACC: {(item as InventoryItemView).weaponStats!.accuracy}</div>
                      <div>SPD: {(item as InventoryItemView).weaponStats!.speed}</div>
                    </div>
                  )}
                  {(item as InventoryItemView).armorStats && (
                    <div style={{ fontSize: 10, color: colors.text, lineHeight: 1.4 }}>
                      <div>DEF: {(item as InventoryItemView).armorStats!.defense}</div>
                    </div>
                  )}
                </InfoCard>

                <InfoCard style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: colors.lime, fontWeight: 600, marginBottom: 8 }}>
                    {equippedInSlot.name} (equipped)
                  </div>
                  {equippedInSlot.weaponStats && (
                    <div style={{ fontSize: 10, color: colors.lime, lineHeight: 1.4 }}>
                      <div>DMG: {equippedInSlot.weaponStats.damage}</div>
                      <div>ACC: {equippedInSlot.weaponStats.accuracy}</div>
                      <div>SPD: {equippedInSlot.weaponStats.speed}</div>
                    </div>
                  )}
                  {equippedInSlot.armorStats && (
                    <div style={{ fontSize: 10, color: colors.lime, lineHeight: 1.4 }}>
                      <div>DEF: {equippedInSlot.armorStats.defense}</div>
                    </div>
                  )}
                </InfoCard>
              </div>
            </div>
          )}

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

            {!shopMode &&
              isInventoryItem &&
              (item.itemClass === 'weapon' || item.itemClass === 'armor') && (
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
                style={{ ...btnStyle, color: colors.gold }}
              >
                Sell {(item as InventoryItemView).sellPrice}g
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}
