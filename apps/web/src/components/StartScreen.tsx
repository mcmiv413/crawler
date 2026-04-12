import React from 'react';

interface StartScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  onCreateGame: (seed?: number, playerName?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function StartScreen({ playerName, setPlayerName, onCreateGame, loading, error }: StartScreenProps) {
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', color: '#ccc', background: '#111', minHeight: '100vh' }}>
      <h1 style={{ color: '#ff8800' }}>Dungeon Crawler</h1>
      <p>A turn-based dungeon crawler with persistent consequences.</p>
      <div style={{ marginTop: 20 }}>
        <label>
          Name:{' '}
          <input
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: 4 }}
          />
        </label>
        <button
          onClick={() => onCreateGame(undefined, playerName)}
          disabled={loading}
          style={{ marginLeft: 10, padding: '4px 16px', background: '#333', color: '#ccc', border: '1px solid #666', cursor: 'pointer' }}
        >
          {loading ? 'Creating...' : 'New Game'}
        </button>
      </div>
      {error && <p style={{ color: '#f44' }}>{error}</p>}
    </div>
  );
}
