import React from 'react';
import type { GameView } from '@dungeon/presenter';
import { btnStyle } from '../styles.js';
import { CombatLogView } from './CombatLogView.js';

interface GameOverPhaseProps {
  view: GameView;
  combatLog: readonly { text: string; type: string }[];
  error: string | null;
  onNewGame: () => void;
}

export function GameOverPhase({ view, combatLog, error, onNewGame }: GameOverPhaseProps) {
  const won = view.runResult === 'victory';
  const permadeath = view.runResult === 'permadeath';
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#ccc', background: '#111', minHeight: '100vh', textAlign: 'center' }}>
      {won ? (
        <>
          <h2 style={{ color: '#ffd700' }} data-testid="victory-heading">Victory!</h2>
          <p style={{ color: '#cc8' }}>You have slain the dungeon's guardian and claimed glory.</p>
        </>
      ) : permadeath ? (
        <>
          <h2 style={{ color: '#a00' }} data-testid="permadeath-heading">Permanent Death</h2>
          <p style={{ color: '#a66' }}>Obliterated beyond recovery. Your legend ends here.</p>
        </>
      ) : (
        <h2 style={{ color: '#f44' }} data-testid="death-heading">You Died</h2>
      )}
      <p>Floor: {view.player.floor} | Gold: <span style={{ color: '#cc8' }}>{view.player.gold}</span></p>
      {view.deathSummary && (
        <div style={{ marginTop: 10, padding: 8, border: '1px solid #4a1a1a', background: '#1a0a0a', textAlign: 'left', display: 'inline-block' }}>
          <h4 style={{ margin: 0, color: '#cc4444' }}>Death Report</h4>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            {view.deathSummary.killerName && <div>Slain by: <span style={{ color: '#f44' }}>{view.deathSummary.killerName}</span></div>}
            <div>Floor: {view.deathSummary.floor}</div>
            <div>Turns survived: {view.deathSummary.turnsSurvived}</div>
            <div>Damage dealt: {view.deathSummary.damageDealt} | Damage taken: {view.deathSummary.damageTaken}</div>
          </div>
        </div>
      )}
      <CombatLogView entries={combatLog} debugMode={view.debugMode} />
      <button onClick={onNewGame} style={btnStyle}>
        {permadeath ? 'Start New Game' : 'Start New Run'}
      </button>
      {error && <p style={{ color: '#f44' }}>{error}</p>}
    </div>
  );
}
