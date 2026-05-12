import React from 'react';
import type { InventoryItemView, InventoryView } from '@dungeon/presenter';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { colors } from '../styles.js';

interface EquipmentDollProps {
  equipped: InventoryView['equipped'];
  onSlotClick: (item: InventoryItemView) => void;
}

function getItemStats(item: InventoryItemView): string {
  let text = '';
  if (item.weaponStats) {
    const ws = item.weaponStats;
    const dmg = `${ws.damageMin}–${ws.damageMax}`;
    text += `${dmg} ${ws.damageType} dmg`;
    if (ws.weaponRange && ws.weaponRange > 1) {
      text += ` | range: ${ws.weaponRange}`;
    }
  }
  if (item.armorStats) {
    text += `${item.armorStats.defense} def`;
    if (item.armorStats.evasionPenalty) {
      text += ` | eva penalty: -${item.armorStats.evasionPenalty}`;
    }
  }
  return text;
}

const SLOT_LABELS: Record<keyof InventoryView['equipped'], string> = {
  weapon: 'Main Hand',
  secondaryWeapon: 'Off Hand',
  chest: 'Chest',
  head: 'Head',
  gloves: 'Gloves',
  boots: 'Boots',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

const SLOT_ORDER: (keyof InventoryView['equipped'])[] = [
  'weapon',
  'secondaryWeapon',
  'chest',
  'head',
  'gloves',
  'boots',
  'ring1',
  'ring2',
];

export function EquipmentDoll({ equipped, onSlotClick }: EquipmentDollProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 16,
        padding: 8,
        border: '1px solid #333',
        background: '#1a1a1a',
      }}
    >
      {SLOT_ORDER.map((slotKey) => {
        const item = equipped[slotKey];
        const label = SLOT_LABELS[slotKey];

        return (
          <div
            key={slotKey}
            style={{
              border: item ? '1px solid #444' : '1px dashed #444',
              padding: 8,
              minHeight: 40,
              background: '#111',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              cursor: item ? 'pointer' : 'default',
            }}
            onClick={() => item && onSlotClick(item)}
          >
            <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>{label}</div>
            {item ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <ItemSpriteIcon spriteName={item.spriteName} size={24} />
                  <div
                    style={{
                      fontSize: 11,
                      color: item.rarityColor,
                      fontWeight: 'bold',
                    }}
                  >
                    {item.name}
                  </div>
                </div>
                {(() => {
                  const stats = getItemStats(item);
                  return stats ? <div style={{ fontSize: 9, color: colors.muted }}>{stats}</div> : null;
                })()}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: '#555' }}>[empty]</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
