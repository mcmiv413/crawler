import React from 'react';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';
import { navBtnStyle } from '../styles.js';

type Screen = 'main' | 'inventory' | 'character' | 'inspect' | 'log';

interface MobileNavProps {
  activeScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  phase: 'town' | 'dungeon';
  onNewGame?: () => void;
}

export function MobileNav({ activeScreen, onScreenChange, phase, onNewGame }: MobileNavProps) {
  const tabBarHeight = TAB_BAR_HEIGHT;

  const tabs: Array<{ id: Screen; label: string; icon: string }> = [
    { id: 'main', label: phase === 'town' ? 'Town' : 'Map', icon: phase === 'town' ? '🏘️' : '🗺️' },
    { id: 'inventory', label: 'Inventory', icon: '🎒' },
    { id: 'character', label: 'Character', icon: '🧙' },
    { id: 'inspect', label: 'Inspect', icon: '🔍' },
    { id: 'log', label: 'Log', icon: '📜' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${tabBarHeight}px`,
        background: '#222',
        borderTop: '1px solid #555',
        zIndex: 100,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onScreenChange(tab.id)}
          style={{
            ...navBtnStyle,
            background: activeScreen === tab.id ? '#555' : '#222',
            borderBottom: activeScreen === tab.id ? '3px solid #4af' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
          }}
        >
          <div style={{ fontSize: 18 }}>{tab.icon}</div>
          <div style={{ fontSize: 11, lineHeight: 1 }}>{tab.label}</div>
        </button>
      ))}
      {onNewGame && (
        <button
          onClick={() => { if (window.confirm('Start a new game? Current progress will be lost.')) onNewGame(); }}
          style={{
            ...navBtnStyle,
            background: '#222',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
          }}
        >
          <div style={{ fontSize: 18 }}>➕</div>
          <div style={{ fontSize: 11, lineHeight: 1 }}>New Game</div>
        </button>
      )}
    </div>
  );
}
