import React from 'react';
import type { GameView, NpcView } from '@dungeon/presenter';
import { btnStyle } from '../styles.js';

interface QuestAssignedScreenProps {
  view: GameView;
  questTitle: string;
  questDescription: string;
  rewardGold: number;
  giverNpc: NpcView | undefined;
  onDismiss: () => void;
}

export function QuestAssignedScreen({
  view,
  questTitle,
  questDescription,
  rewardGold,
  giverNpc,
  onDismiss,
}: QuestAssignedScreenProps) {
  return (
    <div
      style={{
        padding: 20,
        fontFamily: 'monospace',
        color: '#ccc',
        background: '#111',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <h2 style={{ color: '#88f', fontSize: 32, marginBottom: 10 }}>New Quest</h2>

      <div style={{ color: '#8899ff', fontSize: 14, marginBottom: 20, maxWidth: 500 }}>
        {giverNpc ? `${giverNpc.name} has a task for you.` : 'A new opportunity awaits.'}
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 16,
          border: '2px solid #1a3a5a',
          background: '#0a1a2a',
          borderRadius: 4,
          maxWidth: 500,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: '#6688ff', fontSize: 18 }}>{questTitle}</h3>

        <div style={{ textAlign: 'left', fontSize: 12, color: '#aaa', lineHeight: 1.8, marginBottom: 12 }}>
          {questDescription}
        </div>

        <div style={{ borderTop: '1px solid #1a3a5a', paddingTop: 12, marginTop: 12, textAlign: 'center' }}>
          <div style={{ color: '#88dd88', fontSize: 14, fontWeight: 'bold' }}>Reward: {rewardGold}g</div>
        </div>
      </div>

      <button
        onClick={onDismiss}
        style={{
          ...btnStyle,
          background: '#004488',
          color: '#88ddff',
          border: '2px solid #0066aa',
          padding: '12px 24px',
          fontSize: 14,
        }}
      >
        Accept Quest
      </button>
    </div>
  );
}
