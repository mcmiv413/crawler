import React from 'react';
import type { PlayerHudView, EquippedItemView } from '@dungeon/presenter';

const slotLabels: Record<string, string> = {
  weapon: 'Weapon',
  chest: 'Chest',
  head: 'Head',
  gloves: 'Gloves',
  boots: 'Boots',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

const slotOrder = ['weapon', 'chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'];

interface EquipmentOverviewProps {
  player: PlayerHudView;
}

export function EquipmentOverview({ player }: EquipmentOverviewProps) {
  if (!player.equippedItems || player.equippedItems.length === 0) return null;

  // Sort items by slot order
  const sortedItems = [...player.equippedItems].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>EQUIPPED</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sortedItems.map(item => (
          <div
            key={`${item.slot}-${item.itemId}`}
            style={{
              padding: '6px',
              background: '#1a2a1a',
              border: '1px solid #2a4a2a',
              fontSize: 11,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <div style={{ fontWeight: 'bold', color: '#6af', textTransform: 'capitalize' }}>
                {slotLabels[item.slot] ?? item.slot}
              </div>
              <div style={{ color: '#888', fontSize: 10 }}>{item.rarity}</div>
            </div>
            
            <div style={{ color: '#aaa', marginBottom: item.enchantments.length > 0 ? 3 : 0 }}>
              {item.name}
              {item.baseBonus > 0 && <span style={{ color: '#fa4' }}> +{item.baseBonus}</span>}
            </div>

            {item.enchantments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {item.enchantments.map(ench => (
                  <div
                    key={ench.id}
                    style={{
                      padding: '1px 3px',
                      background: '#1a3a1a',
                      border: '1px solid #2a5a2a',
                      color: '#4f4',
                      fontSize: 9,
                      textTransform: 'capitalize',
                    }}
                    title={ench.description}
                  >
                    {ench.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
