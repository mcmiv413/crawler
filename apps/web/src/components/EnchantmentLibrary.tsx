import React, { useState } from 'react';
import type { PlayerHudView } from '@dungeon/presenter';
import { ENCHANTMENT_BY_ID } from '@dungeon/content';

interface EnchantmentDetailModalProps {
  enchantmentId: string;
  itemsUsing: string[];
  onClose: () => void;
}

function EnchantmentDetailModal({ enchantmentId, itemsUsing, onClose }: EnchantmentDetailModalProps) {
  const enchDef = ENCHANTMENT_BY_ID.get(enchantmentId);
  if (!enchDef) return null;

  return (
    <div style={{ marginBottom: 12, padding: 8, background: '#1a3a1a', border: '1px solid #2a6a2a' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6af' }}>{enchDef.name}</div>
          <div style={{ fontSize: 10, color: '#888' }}>Tier {enchDef.tier}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '2px 6px',
            background: '#333',
            color: '#aaa',
            border: '1px solid #555',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, lineHeight: 1.4 }}>
        {enchDef.description}
      </div>

      {itemsUsing.length > 0 && (
        <div style={{ fontSize: 10, color: '#888', borderTop: '1px solid #2a6a2a', paddingTop: 4 }}>
          <div style={{ color: '#4f4', marginBottom: 2, fontWeight: 'bold' }}>Used on:</div>
          {itemsUsing.map((item, idx) => (
            <div key={idx} style={{ color: '#aaa' }}>
              • {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface EnchantmentLibraryProps {
  player: PlayerHudView;
}

export function EnchantmentLibrary({ player }: EnchantmentLibraryProps) {
  const [selectedEnchantmentId, setSelectedEnchantmentId] = useState<string | null>(null);

  // Collect all enchantments from equipped items
  const enchantmentMap = new Map<string, string[]>();
  
  for (const item of player.equippedItems) {
    for (const ench of item.enchantments) {
      const existing = enchantmentMap.get(ench.id) ?? [];
      enchantmentMap.set(ench.id, [...existing, item.name]);
    }
  }

  if (enchantmentMap.size === 0) return null;

  const selectedEnchantment = selectedEnchantmentId ? ENCHANTMENT_BY_ID.get(selectedEnchantmentId) : null;

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>ENCHANTMENTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Array.from(enchantmentMap.entries()).map(([enchId, items]) => {
            const enchDef = ENCHANTMENT_BY_ID.get(enchId);
            if (!enchDef) return null;

            return (
              <button
                key={enchId}
                onClick={() => setSelectedEnchantmentId(selectedEnchantmentId === enchId ? null : enchId)}
                style={{
                  padding: '3px 8px',
                  background: selectedEnchantmentId === enchId ? '#1a4a1a' : '#1a2a1a',
                  color: selectedEnchantmentId === enchId ? '#6f6' : '#4f4',
                  border: `1px solid ${selectedEnchantmentId === enchId ? '#2a6a2a' : '#1a4a1a'}`,
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
                title={enchDef.description}
              >
                {enchDef.name} (T{enchDef.tier})
              </button>
            );
          })}
        </div>
      </div>

      {selectedEnchantment && selectedEnchantmentId && (
        <EnchantmentDetailModal
          enchantmentId={selectedEnchantmentId}
          itemsUsing={enchantmentMap.get(selectedEnchantmentId) ?? []}
          onClose={() => setSelectedEnchantmentId(null)}
        />
      )}
    </>
  );
}
