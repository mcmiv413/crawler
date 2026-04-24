import React, { useState } from 'react';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';
import type { PlayerHudView } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ModalBackdrop, ModalCard, SectionLabel } from './ui/index.js';

interface EnchantmentDetailModalProps {
  player: PlayerHudView;
  onClose: () => void;
}

export function EnchantmentDetailModal({ player, onClose }: EnchantmentDetailModalProps) {
  const enchantmentMap = new Map<string, Array<{ name: string; spriteName?: string }>>();

  for (const item of player.equippedItems) {
    for (const ench of item.enchantments) {
      const existing = enchantmentMap.get(ench.id) ?? [];
      enchantmentMap.set(ench.id, [...existing, { name: item.name, spriteName: item.spriteName }]);
    }
  }

  const [selectedEnchantmentId, setSelectedEnchantmentId] = useState<string>(
    enchantmentMap.size > 0 ? Array.from(enchantmentMap.keys())[0]! : '',
  );

  const selectedEnchantment = selectedEnchantmentId
    ? ENCHANTMENT_BY_ID.get(selectedEnchantmentId)
    : null;

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="ENCHANTMENTS" onClose={onClose} accentColor={colors.teal}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {/* Enchantment List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: '0 0 150px',
              overflowY: 'auto',
              borderRight: `1px solid ${colors.border2}`,
              paddingRight: 10,
            }}
          >
            {Array.from(enchantmentMap.entries()).map(([enchId]) => {
              const enchDef = ENCHANTMENT_BY_ID.get(enchId);
              if (!enchDef) return null;
              const isSelected = selectedEnchantmentId === enchId;
              return (
                <button
                  key={enchId}
                  onClick={() => setSelectedEnchantmentId(enchId)}
                  style={{
                    padding: '6px 8px',
                    background: isSelected ? colors.card : colors.inset,
                    color: colors.teal,
                    border: `1px solid ${isSelected ? colors.border : colors.border2}`,
                    borderRadius: '2px',
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    fontFamily: FONT_STACK,
                  }}
                  title={enchDef.description}
                >
                  {enchDef.name} (T{enchDef.tier})
                </button>
              );
            })}
          </div>

          {/* Enchantment Details */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {selectedEnchantment && selectedEnchantmentId ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: colors.teal, marginBottom: 4 }}>
                    {selectedEnchantment.name}
                  </div>
                  <div style={{ fontSize: 10, color: colors.muted }}>
                    Tier {selectedEnchantment.tier}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <SectionLabel label="Description" />
                  <div style={{ fontSize: 11, color: colors.text, lineHeight: 1.4 }}>
                    {selectedEnchantment.description}
                  </div>
                </div>

                {(() => {
                  const usedOn = enchantmentMap.get(selectedEnchantmentId);
                  if (!usedOn || usedOn.length === 0) return null;
                  return (
                    <div>
                      <SectionLabel label="Used On" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {usedOn.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: 10,
                              color: colors.text,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {item.spriteName && (
                              <ItemSpriteIcon spriteName={item.spriteName} size={16} />
                            )}
                            <span>• {item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div style={{ color: colors.muted, fontSize: 11 }}>
                Select an enchantment to view details
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ ...btnStyle, marginTop: 16, padding: '6px 12px', fontSize: 11 }}
        >
          Close
        </button>
      </ModalCard>
    </ModalBackdrop>
  );
}
