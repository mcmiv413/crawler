import React, { useState, useEffect, useRef } from 'react';
import type { GameView, ShopItemView, NpcView, NemesisView, FactionView } from '@dungeon/presenter';
import { SIDE_PANEL_WIDTH, SIDEBAR_CENTER_WIDTH } from '../config/ui-config.js';
import { CharacterScreen } from './CharacterScreen.js';
import { btnStyle, rarityColor } from '../styles.js';
import { PlayerHud } from './PlayerHud.js';
import { CombatLogView } from './CombatLogView.js';
import { InventoryPanel } from './InventoryPanel.js';
import { InventoryScreen } from './InventoryScreen.js';
import { EnchanterPanel } from './EnchanterPanel.js';
import { RunSummaryPanel } from './RunSummaryPanel.js';
import { ShopPanel } from './ShopPanel.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';

type TownPanel = 'main' | 'shop' | 'tavern' | 'enchanter';

interface TownPhaseProps {
  view: GameView;
  combatLog: readonly { text: string; type: string }[];
  loading: boolean;
  error: string | null;
  sendCommand: (command: unknown) => Promise<void>;
  talkToNpc: (npcId: string, npcName: string) => void;
  npcDialogue: { name: string; text: string } | null;
  setNpcDialogue: (d: { name: string; text: string } | null) => void;
  talkingTo: string | null;
}

function TavernPanel({ view }: { view: GameView }) {
  return (
    <div>
      <h3 style={{ color: '#8888cc' }}>Tavern & Town News</h3>

      {view.town && (
        <div style={{ marginBottom: 10 }}>
          <h4 style={{ margin: 0, color: '#aaa', fontSize: 11 }}>Town Atmosphere</h4>
          <div style={{ color: '#aaa', fontStyle: 'italic', marginBottom: 4, fontSize: 11 }}>{view.town.atmosphereDescription}</div>
          <div style={{ color: '#888', fontSize: 11 }}>
            Prosperity: {view.town.prosperity} | Fear: {view.town.fear} | Corruption: {view.town.corruption}
          </div>
        </div>
      )}

      {view.town?.rumors && view.town.rumors.length > 0 && (
        <div style={{ marginBottom: 10, padding: 8, border: '1px solid #333', background: '#1a1a1a' }}>
          <h4 style={{ margin: 0, color: '#888' }}>Rumors</h4>
          {view.town.rumors.map((rumor: string, i: number) => (
            <div key={i} style={{ fontSize: 11, color: '#999', fontStyle: 'italic', padding: '2px 0' }}>
              &ldquo;{rumor}&rdquo;
            </div>
          ))}
        </div>
      )}

      {view.town && (
        <div style={{ marginBottom: 10, padding: 8, border: '1px solid #4a1a1a', background: '#1a0a0a' }}>
          <h4 style={{ margin: 0, color: '#cc4444' }}>Known Threats</h4>
          {view.town.nemeses.length === 0 ? (
            <div style={{ fontSize: 11, color: '#666', padding: '2px 0' }}>No known nemeses.</div>
          ) : (
            view.town.nemeses.map((n: NemesisView) => (
              <div key={n.id} style={{ fontSize: 11, color: '#cc6666', padding: '2px 0' }}>
                ☠ <strong>{n.name}</strong> {n.title} — Tier {n.tier} · Floor {n.floorOfAscension} · {n.killCount} kill{n.killCount !== 1 ? 's' : ''}
              </div>
            ))
          )}
        </div>
      )}

      {view.activeQuests.length > 0 && (
        <div style={{ marginBottom: 10, padding: 8, border: '1px solid #2a3a2a', background: '#0a1a0a' }}>
          <h4 style={{ margin: 0, color: '#6acc6a' }}>Quest Log</h4>
          {view.activeQuests.map((q: { id: string; title: string; description: string; status: string; rewardGold: number }) => {
            const isComplete = q.status === 'complete';
            const isFailed = q.status === 'failed';
            return (
              <div key={q.id} style={{ fontSize: 11, color: isComplete ? '#4f4' : isFailed ? '#a44' : '#88bb88', padding: '3px 0', opacity: isFailed ? 0.6 : 1 }}>
                <strong>{isComplete ? '✓ ' : ''}{q.title}</strong>
                <span style={{ color: isComplete ? '#4f4' : isFailed ? '#a44' : '#666', marginLeft: 4 }}>[{q.status}]</span>
                <div style={{ color: '#777', fontSize: 10 }}>{q.description}</div>
                <div style={{ color: '#cc8844', fontSize: 10 }}>Reward: {q.rewardGold}g</div>
              </div>
            );
          })}
        </div>
      )}

      {view.town && (
        <div style={{ marginBottom: 10, padding: 8, border: '1px solid #1a2a1a', background: '#0a1a0a' }}>
          <h4 style={{ margin: 0, color: '#6a9a6a' }}>Factions</h4>
          {view.town.factions.length === 0 ? (
            <div style={{ fontSize: 11, color: '#666', padding: '2px 0' }}>No faction activity reported.</div>
          ) : (
            view.town.factions.map((f: FactionView) => (
              <div key={f.id} style={{ fontSize: 11, color: '#669966', padding: '2px 0' }}>
                {f.name} — Power: {f.power}/100{f.power > 60 ? ' ⚠' : f.power === 0 ? ' ✓' : ''} | Disposition: <span style={{ color: f.disposition > 0 ? '#4f4' : f.disposition < 0 ? '#f44' : '#888' }}>{f.disposition > 0 ? '+' : ''}{f.disposition}</span>
                {f.trend === 'rising' && <span style={{ color: '#f44' }}> ↑</span>}
                {f.trend === 'falling' && <span style={{ color: '#4f4' }}> ↓</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function TownPhase({
  view,
  combatLog,
  loading,
  error,
  sendCommand,
  talkToNpc,
  npcDialogue,
  setNpcDialogue,
  talkingTo,
}: TownPhaseProps) {
  const [townPanel, setTownPanel] = useState<TownPanel>('main');
  const { isMobile } = useBreakpoint();

  const mainContent = (
    <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: '#88cc44' }}>Town</h2>
      </div>
      <PlayerHud player={view.player} compact />

      {view.town?.lastRunSummary && (
        <div style={{ marginBottom: 10, padding: 8, border: '1px solid #553300', background: '#221100', color: '#cc8844', fontStyle: 'italic' }}>
          {view.town.lastRunSummary}
        </div>
      )}

      {view.town?.runSummaryStats && <RunSummaryPanel stats={view.town.runSummaryStats} />}

      {view.town?.prepAdvice && view.town.prepAdvice.length > 0 && (
        <div style={{ marginBottom: 10, padding: 8, border: '1px solid #2a3a2a', background: '#0a1a0a' }}>
          <h4 style={{ margin: 0, color: '#88bb88' }}>Preparation</h4>
          {view.town.prepAdvice.map((advice: string, i: number) => (
            <div key={i} style={{ fontSize: 11, color: '#aaa', padding: '2px 0' }}>&#x2022; {advice}</div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <button onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'rest' })} style={btnStyle} disabled={loading}>
          Rest & Heal
        </button>
        <button onClick={() => { setNpcDialogue(null); sendCommand({ type: 'TOWN_ACTION', action: 'enter_dungeon' }); }} style={{ ...btnStyle, background: '#442200' }} disabled={loading}>
          Enter Dungeon
        </button>
        {view.town?.lastRetreatFloor && view.town.lastRetreatFloor > 1 && (
          <button onClick={() => { setNpcDialogue(null); sendCommand({ type: 'TOWN_ACTION', action: 'enter_dungeon', startDepth: view.town!.lastRetreatFloor }); }} style={{ ...btnStyle, background: '#224422' }} disabled={loading} title="Continue from where you left off">
            Continue from Floor {view.town.lastRetreatFloor}
          </button>
        )}
        {view.deathStashFloor && view.deathStashFloor > 0 && (
          <button onClick={() => { setNpcDialogue(null); sendCommand({ type: 'TOWN_ACTION', action: 'enter_dungeon', startDepth: view.deathStashFloor }); }} style={{ ...btnStyle, background: '#442222' }} disabled={loading} title="Return to retrieve your lost items">
            Return to Floor {view.deathStashFloor}
          </button>
        )}
      </div>

      {view.town?.npcs && view.town.npcs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h3 style={{ color: '#8888cc' }}>NPCs</h3>
          {view.town.npcs.filter((n: NpcView) => n.available).map((npc: NpcView) => {
            const healCost = Math.max(0, view.player.maxHealth - view.player.health);
            const canHeal = view.player.health < view.player.maxHealth && view.player.gold >= healCost;

            return (
              <div key={npc.id} style={{ padding: 2 }}>
                <strong>{npc.name}</strong> <span style={{ color: '#666' }}>({npc.role})</span>
                <button
                  onClick={() => talkToNpc(npc.id, npc.name)}
                  style={{ ...btnStyle, fontSize: 11, padding: '2px 8px', marginLeft: 8 }}
                  disabled={loading || talkingTo !== null}
                >
                  {talkingTo === npc.id ? '...' : 'Talk'}
                </button>
                {npc.role === 'healer' && (
                  <button
                    onClick={() => sendCommand({ type: 'TOWN_ACTION', action: 'rest' })}
                    style={{ ...btnStyle, fontSize: 11, padding: '2px 8px', marginLeft: 4, color: canHeal ? '#4f4' : '#666' }}
                    disabled={loading || !canHeal}
                    title={view.player.health >= view.player.maxHealth ? 'Already at full health' : `Heal ${healCost}g`}
                  >
                    Heal ({healCost}g)
                  </button>
                )}
                {npc.role === 'shopkeeper' && (
                  <button
                    onClick={() => setTownPanel('shop')}
                    style={{ ...btnStyle, fontSize: 11, padding: '2px 8px', marginLeft: 4 }}
                  >
                    Shop →
                  </button>
                )}
                {npc.role === 'enchanter' && (
                  <button
                    onClick={() => setTownPanel('enchanter')}
                    style={{ ...btnStyle, fontSize: 11, padding: '2px 8px', marginLeft: 4 }}
                  >
                    Enchant →
                  </button>
                )}
                {npc.role === 'informant' && (
                  <button
                    onClick={() => setTownPanel('tavern')}
                    style={{ ...btnStyle, fontSize: 11, padding: '2px 8px', marginLeft: 4 }}
                  >
                    Tavern →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {npcDialogue && (
        <div style={{ marginTop: 10, padding: 8, border: '1px solid #446', background: '#1a1a2a' }}>
          <strong style={{ color: '#aaf' }}>{npcDialogue.name}:</strong>{' '}
          <span style={{ color: '#ccc' }}>{npcDialogue.text}</span>
          <button onClick={() => setNpcDialogue(null)} style={{ ...btnStyle, fontSize: 10, marginLeft: 8 }}>[x]</button>
        </div>
      )}

      {error && <p style={{ color: '#f44' }}>{error}</p>}
    </div>
  );

  // Shop panel
  if (townPanel === 'shop') {
    return (
      <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'auto' }}>
        <button onClick={() => setTownPanel('main')} style={{ ...btnStyle, marginBottom: 8, width: '100%' }}>
          ← Back to Town
        </button>
        {view.town?.shop ? <ShopPanel view={view} loading={loading} sendCommand={sendCommand} /> : null}
      </div>
    );
  }

  // Tavern panel
  if (townPanel === 'tavern') {
    return (
      <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'auto' }}>
        <button onClick={() => setTownPanel('main')} style={{ ...btnStyle, marginBottom: 8, width: '100%' }}>
          ← Back to Town
        </button>
        <TavernPanel view={view} />
      </div>
    );
  }

  // Enchanter panel
  if (townPanel === 'enchanter') {
    return (
      <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'auto' }}>
        <button onClick={() => setTownPanel('main')} style={{ ...btnStyle, marginBottom: 8, width: '100%' }}>
          ← Back to Town
        </button>
        {view.town ? <EnchanterPanel town={view.town} inventory={view.inventory} playerGold={view.player.gold} /> : null}
      </div>
    );
  }

  // Default: main town view
  return mainContent;
}
