import React from 'react';
import { btnPrimaryStyle, colors, FONT_STACK } from '../styles.js';
import { ScreenOverlay } from './ui/index.js';

interface StartScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  onCreateGame: (seed?: number, playerName?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function StartScreen({
  playerName,
  setPlayerName,
  onCreateGame,
  loading,
  error,
}: StartScreenProps) {
  return (
    <ScreenOverlay>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ color: colors.gold, marginBottom: 8, fontSize: 24 }}>Dungeon Crawler</h1>
        <p style={{ color: colors.muted, fontSize: 12, marginBottom: 20 }}>
          A turn-based dungeon crawler with persistent consequences.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: colors.text }}>
            Name:{' '}
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{
                background: colors.inset,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '2px',
                padding: '6px 8px',
                fontFamily: FONT_STACK,
                fontSize: 12,
              }}
            />
          </label>
        </div>

        <button
          onClick={() => onCreateGame(undefined, playerName)}
          disabled={loading}
          style={{ ...btnPrimaryStyle, minWidth: 160 }}
        >
          {loading ? 'Creating...' : 'New Game'}
        </button>

        {error && <p style={{ color: colors.blood, marginTop: 12, fontSize: 12 }}>{error}</p>}
      </div>
    </ScreenOverlay>
  );
}
