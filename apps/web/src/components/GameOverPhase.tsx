import React from 'react';
import type { GameView } from '@dungeon/presenter';
import { btnStyle, compactBtnStyleMobile } from '../styles.js';
import { CombatLogView } from './CombatLogView.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';

interface GameOverPhaseProps {
  view: GameView;
  combatLog: readonly { text: string; type: string }[];
  error: string | null;
  onNewGame: () => void;
}

export function GameOverPhase({ view, combatLog, error, onNewGame }: GameOverPhaseProps) {
  const won = view.runResult === 'victory';
  const permadeath = view.runResult === 'permadeath';
  const { isMobile } = useBreakpoint();
  const buttonStyle = isMobile ? compactBtnStyleMobile : btnStyle;
  
  return (
    <div style={{ height: '100vh', padding: isMobile ? 10 : 20, fontFamily: 'monospace', color: '#ccc', background: '#111', textAlign: 'center', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {won ? (
          <>
            <h2 style={{ color: '#ffd700', marginTop: isMobile ? 10 : 20, marginBottom: 10 }} data-testid="victory-heading">Victory!</h2>
            <p style={{ color: '#cc8', marginBottom: 10 }}>You have slain the dungeon's guardian and claimed glory.</p>
          </>
        ) : permadeath ? (
          <>
            <h2 style={{ color: '#a00', marginTop: isMobile ? 10 : 20, marginBottom: 10 }} data-testid="permadeath-heading">Permanent Death</h2>
            <p style={{ color: '#a66', marginBottom: 10 }}>Obliterated beyond recovery. Your legend ends here.</p>
          </>
        ) : (
          <h2 style={{ color: '#f44', marginTop: isMobile ? 10 : 20, marginBottom: 10 }} data-testid="death-heading">You Died</h2>
        )}
        <p style={{ marginBottom: 10 }}>Floor: {view.player.floor} | Gold: <span style={{ color: '#cc8' }}>{view.player.gold}</span></p>
        {view.deathSummary && (
          <div style={{ marginTop: 10, padding: 8, border: '1px solid #4a1a1a', background: '#1a0a0a', textAlign: 'left', display: 'inline-block', marginBottom: 10 }}>
            <h4 style={{ margin: 0, color: '#cc4444' }}>Death Report</h4>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
              {view.deathSummary.killerName && <div>Slain by: <span style={{ color: '#f44' }}>{view.deathSummary.killerName}</span></div>}
              <div>Floor: {view.deathSummary.floor}</div>
              <div>Turns survived: {view.deathSummary.turnsSurvived}</div>
              <div>Damage dealt: {view.deathSummary.damageDealt} | Damage taken: {view.deathSummary.damageTaken}</div>
            </div>
          </div>
        )}
        <CombatLogView entries={combatLog} debugMode={view.debugMode} maxHeight={isMobile ? 60 : 180} />
      </div>
      <div style={{ flexShrink: 0, paddingTop: isMobile ? 8 : 12 }}>
        <button onClick={onNewGame} style={{ ...buttonStyle, display: 'block', margin: '0 auto', width: '100%', maxWidth: '200px', boxSizing: 'border-box' }}>
          {permadeath ? 'Start New Game' : 'Start New Run'}
        </button>
      </div>
      {error && <p style={{ color: '#f44', fontSize: 12, marginTop: 8, flexShrink: 0 }}>{error}</p>}
    </div>
  );
}
