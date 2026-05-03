import React from 'react';
import { TAB_BAR_HEIGHT, Z_TAB_BAR, BREAKPOINT_NAV_LABEL } from '../config/ui-config.js';
import { navBtnStyle } from '../styles.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';

type Screen = 'main' | 'inventory' | 'character' | 'log';

interface MobileNavProps {
  openScreens: ReadonlySet<Screen>;
  onScreenChange: (screen: Screen) => void;
  phase: 'town' | 'dungeon';
  onNewGame?: () => void;
}

export function MobileNav({ openScreens, onScreenChange, phase, onNewGame }: MobileNavProps) {
  const tabBarHeight = TAB_BAR_HEIGHT;
  const { isMobile } = useBreakpoint();

  // On very narrow screens (< BREAKPOINT_NAV_LABEL), hide labels, show only icons
  // On wider screens, show both icons and labels
  const showLabels = typeof window !== 'undefined' && window.innerWidth >= BREAKPOINT_NAV_LABEL;

  const tabs: Array<{ id: Screen; label: string; icon: string }> = [
    { id: 'main', label: phase === 'town' ? 'Town' : 'Map', icon: phase === 'town' ? '🏘️' : '🗺️' },
    { id: 'inventory', label: 'Inventory', icon: '🎒' },
    { id: 'character', label: 'Character', icon: '🧙' },
    { id: 'log', label: 'Log', icon: '📜' },
  ];

  // Icon and label sizes scale based on available space
  const iconSize = isMobile ? (showLabels ? 14 : 18) : 18;
  const labelSize = isMobile ? 9 : 11;

  return (
    <div
      style={{
        display: 'flex',
        flexShrink: 0,
        height: `${tabBarHeight}px`,
        background: '#222',
        borderTop: '1px solid #555',
        zIndex: Z_TAB_BAR,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === 'main' ? openScreens.size === 0 : openScreens.has(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => onScreenChange(tab.id)}
            style={{
              ...navBtnStyle,
              background: isActive ? '#555' : '#222',
              borderBottom: isActive ? '3px solid #4af' : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: showLabels ? '2px' : '0px',
              flex: 1,
              minWidth: 0,
              padding: isMobile && !showLabels ? '4px 2px' : '4px 6px',
            }}
          >
            <div style={{ fontSize: iconSize, lineHeight: 1 }}>{tab.icon}</div>
            {showLabels && (
              <div style={{ fontSize: labelSize, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                {tab.label}
              </div>
            )}
          </button>
        );
      })}
      <button
        onClick={() => {
          if (onNewGame && window.confirm('Start a new game? Current progress will be lost.')) {
            onNewGame();
          }
        }}
        style={{
          ...navBtnStyle,
          background: '#222',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: showLabels ? '2px' : '0px',
          flex: 1,
          minWidth: 0,
          padding: isMobile && !showLabels ? '4px 2px' : '4px 6px',
        }}
      >
        <div style={{ fontSize: iconSize, lineHeight: 1 }}>➕</div>
        {showLabels && (
          <div style={{ fontSize: labelSize, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
            New Game
          </div>
        )}
      </button>
    </div>
  );
}
