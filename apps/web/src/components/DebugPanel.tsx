import React, { useState } from 'react';
import { useGameStore } from '../store/game-store.js';
import { API_BASE_URL } from '../config/api.js';

const BASE = API_BASE_URL;

async function debugInject(gameId: string, patch: Record<string, unknown>): Promise<void> {
  await fetch(`${BASE}/debug/inject/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function DebugPanel() {
  const { gameId, createGame } = useGameStore();
  const [status, setStatus] = useState('');

  if (!gameId) return null;

  async function run(patch: Record<string, unknown>) {
    setStatus('...');
    try {
      await debugInject(gameId!, patch);
      // Refresh view by re-fetching
      window.location.reload();
    } catch (e) {
      setStatus(String(e));
    }
  }

  const btn = (label: string, patch: Record<string, unknown>) => (
    <button
      key={label}
      onClick={() => run(patch)}
      style={{ margin: 2, padding: '3px 8px', fontSize: 11, background: '#2a1a2a', color: '#f8f', border: '1px solid #844', cursor: 'pointer' }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginTop: 10, padding: 8, border: '1px solid #844', background: '#110a11', fontSize: 11 }}>
      <div style={{ color: '#f8f', marginBottom: 4 }}>🛠 Debug Panel</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {btn('Blade T1 (15 hits)', { weaponMastery: { blade: 15 } })}
        {btn('Blade T2 (40 hits)', { weaponMastery: { blade: 40 } })}
        {btn('All T1 (15 hits each)', { weaponMastery: { blade: 15, bludgeon: 15, axe: 15, ranged: 15 } })}
        {btn('All T2 (40 hits each)', { weaponMastery: { blade: 40, bludgeon: 40, axe: 40, ranged: 40 } })}
        {btn('Grant All Mastery', { abilities: ['blade_bleed', 'blade_riposte', 'bludgeon_stagger', 'bludgeon_shatter', 'axe_cleave', 'axe_execute', 'ranged_pin', 'ranged_volley'] })}
        {btn('Level 10', { playerLevel: 10 })}
        {btn('Unlock T1 Blueprints', { unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire', 'resist_frost', 'resist_poison'] })}
        {btn('Unlock T2 Blueprints', { unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire', 'resist_frost', 'resist_poison', 'evasion_boost', 'defense_boost', 'blight_ward', 'spikes', 'speed_boost'] })}
        {btn('Unlock All Blueprints', { unlockedBlueprints: ['hp_regen', 'thorns', 'resist_fire', 'resist_frost', 'resist_poison', 'evasion_boost', 'defense_boost', 'blight_ward', 'spikes', 'speed_boost', 'exp_bonus', 'life_steal', 'arcane_ward', 'blink'] })}
      </div>
      {status && <div style={{ color: '#f84', marginTop: 4 }}>{status}</div>}
    </div>
  );
}
