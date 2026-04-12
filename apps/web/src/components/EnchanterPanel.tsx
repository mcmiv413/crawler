import React from 'react';
import type { TownView, InventoryView } from '@dungeon/presenter';
import { useGameStore } from '../store/game-store.js';
import { ENCHANTMENT_BY_ID, getEnchantmentCost } from '@dungeon/content';

const EQUIP_SLOT_LABELS: Record<string, string> = {
  chest: 'Chest', head: 'Head', gloves: 'Gloves', boots: 'Boots', ring1: 'Ring 1', ring2: 'Ring 2',
};

const ARMOR_SLOTS = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const;

interface Props {
  town: TownView;
  inventory: InventoryView;
  playerGold: number;
}

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  margin: '1px 2px',
  background: '#1a2a3a',
  color: '#4af',
  border: '1px solid #35f',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
};

export function EnchanterPanel({ town, inventory, playerGold }: Props) {
  const { sendCommand, loading } = useGameStore();
  const blueprints = town.unlockedBlueprints;

  if (blueprints.length === 0) {
    return (
      <div style={{ marginTop: 8, padding: 8, border: '1px solid #336', background: '#0d0d1a' }}>
        <h4 style={{ margin: 0, color: '#88f', fontSize: 13 }}>Enchanter — Seraphel</h4>
        <p style={{ color: '#666', fontSize: 11 }}>No enchantment blueprints unlocked. Find enchanted armor in the dungeon to unlock blueprints.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: 8, border: '1px solid #336', background: '#0d0d1a' }}>
      <h4 style={{ margin: 0, color: '#88f', fontSize: 13 }}>Enchanter — Seraphel</h4>
      <div style={{ marginBottom: 6, color: '#cc8', fontSize: 11 }}>Gold: {playerGold}g</div>
      <p style={{ color: '#666', fontSize: 10, margin: '2px 0 6px' }}>Apply permanent enchantments to your equipped armor.</p>

      {ARMOR_SLOTS.map(slot => {
        const item = inventory.equipped[slot];
        if (item?.itemClass !== 'armor') return null;
        const armorStats = item.armorStats;
        if (!armorStats || armorStats.enchantmentSlots === 0) return null;

        const filledCount = armorStats.enchantments.filter(e => e !== null).length;
        const freeSlots = armorStats.enchantmentSlots - filledCount;
        const appliedEnchantments = armorStats.enchantments.filter((e): e is string => e !== null);

        return (
          <div key={slot} style={{ marginBottom: 8, paddingLeft: 4, borderLeft: '2px solid #334' }}>
            <div style={{ color: '#aaf', fontSize: 12 }}>
              {EQUIP_SLOT_LABELS[slot]}: {item.name}
              <span style={{ color: '#555', marginLeft: 6 }}>({freeSlots}/{armorStats.enchantmentSlots} slots free)</span>
            </div>
            {appliedEnchantments.length > 0 && (
              <div style={{ color: '#4f8', fontSize: 10, paddingLeft: 8 }}>
                Applied: {appliedEnchantments.map(id => ENCHANTMENT_BY_ID.get(id)?.name ?? id).join(', ')}
              </div>
            )}
            {freeSlots > 0 && (
              <div style={{ paddingLeft: 8, marginTop: 2 }}>
                {blueprints.map(enchId => {
                  if (appliedEnchantments.includes(enchId)) return null;
                  const enchDef = ENCHANTMENT_BY_ID.get(enchId);
                  if (!enchDef) return null;
                  const cost = getEnchantmentCost(enchId);
                  const canAfford = playerGold >= cost;
                  return (
                    <button
                      key={enchId}
                      style={{ ...btnStyle, opacity: canAfford ? 1 : 0.4 }}
                      disabled={loading || !canAfford}
                      onClick={() => sendCommand({ type: 'ENCHANT_ARMOR', equipSlot: slot, enchantmentId: enchId })}
                      title={canAfford ? `Cost: ${cost}g` : `Need ${cost}g (you have ${playerGold}g)`}
                    >
                      {enchDef.name} — {cost}g
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
