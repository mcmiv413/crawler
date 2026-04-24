import React, { useRef, useEffect } from 'react';
import { COMBAT_LOG_MAX_HEIGHT } from '../config/ui-config.js';
import { useGameStore } from '../store/game-store.js';
import { colors, logEntryColor, FONT_STACK } from '../styles.js';

interface CombatLogViewProps {
  entries: readonly { text: string; type: string }[];
  debugMode: boolean;
  maxHeight?: number;
  isMobile?: boolean;
}

export function CombatLogView({ entries, debugMode, maxHeight, isMobile = false }: CombatLogViewProps) {
  const computedMaxHeight = maxHeight ?? (isMobile ? 'none' : COMBAT_LOG_MAX_HEIGHT);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toggleDebugLogging } = useGameStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const filteredEntries = entries.filter(entry => {
    if (!debugMode && entry.text.startsWith('[DEBUG]')) return false;
    return true;
  });

  if (filteredEntries.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      style={{
        marginTop: 10,
        maxHeight: computedMaxHeight,
        overflowY: 'auto',
        border: `1px solid ${colors.border}`,
        padding: 5,
        background: colors.inset,
        display: 'flex',
        flexDirection: 'column',
        flex: computedMaxHeight === 'none' ? 1 : undefined,
        minHeight: 0,
        fontFamily: FONT_STACK,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          paddingBottom: 5,
          borderBottom: `1px solid ${colors.border2}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: colors.muted,
          }}
        >
          Log
        </span>
        <button
          onClick={toggleDebugLogging}
          style={{
            fontFamily: FONT_STACK,
            padding: '2px 8px',
            fontSize: 10,
            background: debugMode ? colors.blood : '#2a2a2a',
            color: debugMode ? '#fff' : '#666',
            border: `1px solid ${debugMode ? colors.blood : '#444'}`,
            cursor: 'pointer',
            borderRadius: '2px',
          }}
          title="Toggle game debug mode to see ambient behavior transitions"
        >
          {debugMode ? '🐛 DEBUG ON' : 'DEBUG'}
        </button>
      </div>

      {/* Entries */}
      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {filteredEntries.map((entry, index) => (
          <div
            key={`${index}-${entry.type}-${entry.text}`}
            style={{
              fontSize: 11,
              lineHeight: 1.4,
              color: logEntryColor(entry.type),
              fontWeight: entry.type === 'death' ? 600 : 400,
              padding: '2px 0',
              borderBottom: index < filteredEntries.length - 1
                ? `1px solid ${colors.border2}`
                : 'none',
            }}
          >
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
