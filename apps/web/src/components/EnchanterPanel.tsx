import React from 'react';
import type { TownView, InventoryView } from '@dungeon/presenter';
import { useGameStore } from '../store/game-store.js';
import { ENCHANTMENT_BY_ID, getEnchantmentCost } from '@dungeon/content';
import { colors, FONT_STACK } from '../styles.js';
import { InfoCard, SectionLabel } from './ui/index.js';

const EQUIP_SLOT_LABELS: Record<string, string> = {
  chest: 'Chest',
  head: 'Head',
  gloves: 'Gloves',
  boots: 'Boots',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
};

const ARMOR_SLOTS = ['chest', 'head', 'gloves', 'boots', 'ring1', 'ring2'] as const;

interface Props {
  town: TownView;
  inventory: InventoryView;
  playerGold: number;
}

const enchantBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  margin: '2px 3px 2px 0',
  background: '#0e1e1a',
  color: colors.teal,
  border: `1px solid #1a3e3a`,
  cursor: 'pointer',
  fontFamily: FONT_STACK,
  fontSize: 11,
  borderRadius: '2px',
};

const headerStyle: React.CSSProperties = {
  margin: 0,
  color: colors.teal,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.08em',
  fontFamily: FONT_STACK,
};

export function EnchanterPanel({ town, inventory, playerGold }: Props) {
  const { sendCommand, loading } = useGameStore();
  const blueprints = town.unlockedBlueprints;

  if (blueprints.length === 0) {
    return (
      <InfoCard borderColor="#1a3e3a" style={{ marginTop: 8 }}>
        <h4 style={headerStyle}>Enchanter — Seraphel</h4>
        <p style={{ color: colors.muted, fontSize: 11, margin: '6px 0 0', fontFamily: FONT_STACK }}>
          No enchantment blueprints unlocked. Find enchanted armor in the dungeon to unlock blueprints.
        </p>
      </InfoCard>
    );
  }

  return (
    <InfoCard borderColor="#1a3e3a" style={{ marginTop: 8 }}>
      <h4 style={headerStyle}>Enchanter — Seraphel</h4>
      <div style={{ marginTop: 4, color: colors.gold, fontSize: 11, fontFamily: FONT_STACK }}>
        Gold: {playerGold}g
      </div>
      <p style={{ color: colors.muted, fontSize: 10, margin: '4px 0 8px', fontFamily: FONT_STACK }}>
        Apply permanent enchantments to your equipped armor.
      </p>

      {ARMOR_SLOTS.map((slot) => {
        const item = inventory.equipped[slot];
        if (item?.itemClass !== 'armor') return null;
        const armorStats = item.armorStats;
        if (!armorStats || armorStats.enchantmentSlots === 0) return null;

        const filledCount = armorStats.enchantments.filter((e) => e !== null).length;
        const freeSlots = armorStats.enchantmentSlots - filledCount;
        const appliedEnchantments = armorStats.enchantments.filter((e): e is string => e !== null);

        return (
          <div key={slot} style={{ marginBottom: 10 }}>
            <SectionLabel
              label={`${EQUIP_SLOT_LABELS[slot]} — ${freeSlots}/${armorStats.enchantmentSlots} free`}
              color={colors.teal}
            />
            <div style={{ color: colors.text, fontSize: 12, fontFamily: FONT_STACK, marginBottom: 4 }}>
              {item.name}
            </div>
            {appliedEnchantments.length > 0 && (
              <div
                style={{
                  color: colors.lime,
                  fontSize: 10,
                  fontFamily: FONT_STACK,
                  marginBottom: 4,
                }}
              >
                Applied: {appliedEnchantments.map((id) => ENCHANTMENT_BY_ID.get(id)?.name ?? id).join(', ')}
              </div>
            )}
            {freeSlots > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {blueprints.map((enchId) => {
                  if (appliedEnchantments.includes(enchId)) return null;
                  const enchDef = ENCHANTMENT_BY_ID.get(enchId);
                  if (!enchDef) return null;
                  const cost = getEnchantmentCost(enchId);
                  const canAfford = playerGold >= cost;
                  return (
                    <button
                      key={enchId}
                      style={{ ...enchantBtnStyle, opacity: canAfford ? 1 : 0.4 }}
                      disabled={loading || !canAfford}
                      onClick={() =>
                        sendCommand({ type: 'ENCHANT_ARMOR', equipSlot: slot, enchantmentId: enchId })
                      }
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
    </InfoCard>
  );
}
