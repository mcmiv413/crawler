import React, { useState } from 'react';
import type { EnchantmentView, PlayerHudView } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { colors, FONT_STACK, btnStyle } from '../styles.js';
import { ModalBackdrop, ModalCard, SectionLabel } from './ui/index.js';

interface EnchantmentDetailModalProps {
  player: PlayerHudView;
  onClose: () => void;
}

export function EnchantmentDetailModal({ player, onClose }: EnchantmentDetailModalProps) {
  const enchantmentMap = new Map<string, { enchantment: EnchantmentView; usedOn: Array<{ name: string; spriteName?: string }> }>();

  for (const item of player.equippedItems) {
    for (const ench of item.enchantments) {
      const existing = enchantmentMap.get(ench.id);
      enchantmentMap.set(ench.id, {
        enchantment: ench,
        usedOn: [...(existing?.usedOn ?? []), { name: item.name, spriteName: item.spriteName }],
      });
    }
  }

  const enchantmentEntries = Array.from(enchantmentMap.entries());

  const [selectedEnchantmentId, setSelectedEnchantmentId] = useState<string>(
    enchantmentEntries[0]?.[0] ?? '',
  );

  const selectedEnchantmentEntry = enchantmentEntries.find(([enchId]) => enchId === selectedEnchantmentId);
  const selectedEnchantmentDetails = selectedEnchantmentEntry?.[1];
  const selectedEnchantment = selectedEnchantmentDetails?.enchantment;

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
            {enchantmentEntries.map(([enchId, entry]) => {
              const enchDef = entry.enchantment;
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
            {selectedEnchantment !== undefined && selectedEnchantmentDetails !== undefined ? (
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

                {selectedEnchantmentDetails.usedOn.length > 0 && (
                    <div>
                      <SectionLabel label="Used On" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {selectedEnchantmentDetails.usedOn.map((item) => (
                          <div
                            key={`${item.name}-${item.spriteName ?? 'none'}`}
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
                )}
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
