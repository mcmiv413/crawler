import React, { useState } from 'react';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';
import type { PlayerHudView } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon';

interface EnchantmentDetailModalProps {
  player: PlayerHudView;
  onClose: () => void;
}

export function EnchantmentDetailModal({ player, onClose }: EnchantmentDetailModalProps) {
  // Collect all enchantments from equipped items with sprite data
  const enchantmentMap = new Map<string, Array<{ name: string; spriteName?: string }>>();

  for (const item of player.equippedItems) {
    for (const ench of item.enchantments) {
      const existing = enchantmentMap.get(ench.id) ?? [];
      enchantmentMap.set(ench.id, [...existing, { name: item.name, spriteName: item.spriteName }]);
    }
  }

  const [selectedEnchantmentId, setSelectedEnchantmentId] = useState<string>(
    enchantmentMap.size > 0 ? Array.from(enchantmentMap.keys())[0]! : ''
  );

  const selectedEnchantment = selectedEnchantmentId ? ENCHANTMENT_BY_ID.get(selectedEnchantmentId) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2a',
          border: '2px solid #4a8a6a',
          borderRadius: '4px',
          padding: '16px',
          maxWidth: '500px',
          color: '#ccc',
          fontFamily: 'monospace',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold', color: '#6af', marginBottom: 12 }}>ENCHANTMENTS</div>

        <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
          {/* Enchantment List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flex: '0 0 150px',
              overflowY: 'auto',
              borderRight: '1px solid #333',
              paddingRight: '12px',
            }}
          >
            {Array.from(enchantmentMap.entries()).map(([enchId]) => {
              const enchDef = ENCHANTMENT_BY_ID.get(enchId);
              if (!enchDef) return null;

              return (
                <button
                  key={enchId}
                  onClick={() => setSelectedEnchantmentId(enchId)}
                  style={{
                    padding: '6px 8px',
                    background: selectedEnchantmentId === enchId ? '#1a4a2a' : '#1a2a1a',
                    color: selectedEnchantmentId === enchId ? '#6f6' : '#4f4',
                    border: `1px solid ${selectedEnchantmentId === enchId ? '#2a8a4a' : '#1a4a1a'}`,
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
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
                  <div style={{ fontSize: 14, fontWeight: 'bold', color: '#6af', marginBottom: 4 }}>
                    {selectedEnchantment.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
                    Tier {selectedEnchantment.tier}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>DESCRIPTION</div>
                  <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.4 }}>
                    {selectedEnchantment.description}
                  </div>
                </div>

                {selectedEnchantmentId && enchantmentMap.get(selectedEnchantmentId) && enchantmentMap.get(selectedEnchantmentId)!.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>USED ON</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {enchantmentMap.get(selectedEnchantmentId)!.map((item, idx) => (
                        <div key={idx} style={{ fontSize: 10, color: '#6af', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {item.spriteName && <ItemSpriteIcon spriteName={item.spriteName} size={16} />}
                          <span>• {item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#888', fontSize: 11 }}>Select an enchantment to view details</div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            padding: '6px 12px',
            background: '#2a2a3a',
            color: '#ccc',
            border: '1px solid #444',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
