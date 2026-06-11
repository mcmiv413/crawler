import { useRef, useEffect } from 'react';
import { useGameStore } from '../store/game-store.js';
import { colors, logEntryColor, FONT_STACK } from '../styles.js';
import { filterCombatLogForDisplay } from './combat-log-filter.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { TAB_BAR_HEIGHT } from '../config/ui-config.js';

interface CombatLogViewProps {
  entries: readonly { text: string; type: string }[];
  debugMode: boolean;
  maxHeight?: number;
}

export function CombatLogView({ entries, debugMode, maxHeight }: CombatLogViewProps) {
  const computedMaxHeight = maxHeight ?? 'none';
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toggleDebugLogging } = useGameStore();
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const filteredEntries = filterCombatLogForDisplay(entries, debugMode);

  if (filteredEntries.length === 0) return null;

  return (
    <div
      className="combat-log-view"
      style={{
        marginTop: 10,
        maxHeight: computedMaxHeight,
        overflow: 'hidden',
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
            background: debugMode ? colors.blood : colors.card,
            color: debugMode ? colors.text : colors.muted,
            border: `1px solid ${debugMode ? colors.blood : colors.border}`,
            cursor: 'pointer',
            borderRadius: '2px',
          }}
          title="Toggle game debug mode to see ambient behavior transitions"
        >
          {debugMode ? 'DEBUG ON' : 'DEBUG'}
        </button>
      </div>

      {/* Entries */}
      <div
        ref={scrollRef}
        data-testid="combat-log-entries"
        style={{
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          paddingBottom: isMobile ? TAB_BAR_HEIGHT : 0,
        }}
      >
        {filteredEntries.map((entry, index) => (
          <div
            key={`${entry.type}-${entry.text}`}
            data-testid="combat-log-entry"
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
