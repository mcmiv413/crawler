import React, { useEffect, useMemo, useState } from 'react';
import type { GameView } from '@dungeon/presenter';
import { VP_WIDTH, VP_HEIGHT } from '../config/ui-config.js';
import {
  TAB_BAR_HEIGHT,
  COMBAT_INDICATOR_FADEOUT_MS,
  COMBAT_LOG_MINI_FONT_SIZE,
  COMBAT_LOG_MINI_LINE_HEIGHT,
  COMBAT_LOG_MINI_ENTRIES,
} from '../config/ui-config.js';
import { PlayerHud } from './PlayerHud.js';
import { DungeonView } from './DungeonView.js';
import { DungeonCanvas } from './DungeonCanvas.js';
import { DebugPanel } from './DebugPanel.js';
import { UnifiedActionPanel } from './UnifiedActionPanel.js';
import { InspectModal } from './InspectModal.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { CombatIndicators } from './CombatIndicators.js';
import { BumpAnimations } from './BumpAnimations.js';
import { useAnimationOrchestrator } from '../hooks/useAnimationOrchestrator.js';
import { filterCombatLogForDisplay } from './combat-log-filter.js';
import { logEntryColor } from '../styles.js';

interface DungeonPhaseProps {
  view: GameView;
  combatLog: readonly { text: string; type: string }[];
  loading: boolean;
  error: string | null;
  sendCommand: (command: unknown) => Promise<void>;
  useSprites: boolean;
  setUseSprites: React.Dispatch<React.SetStateAction<boolean>>;
}

function dangerColor(level: string): string {
  switch (level) {
    case 'safe':
      return '#4f4';
    case 'moderate':
      return '#ff4';
    case 'dangerous':
      return '#f84';
    case 'deadly':
      return '#f44';
    default:
      return '#aaa';
  }
}

function MiniCombatLog({
  entries,
  debugMode,
}: {
  entries: readonly { text: string; type: string }[];
  debugMode: boolean;
}) {
  const filtered = filterCombatLogForDisplay(entries, debugMode);
  const recent = filtered.slice(-COMBAT_LOG_MINI_ENTRIES);
  if (recent.length === 0) return null;

  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #222', paddingTop: 4 }}>
      {recent.map((entry, index) => (
        <div
          key={`${index}-${entry.type}-${entry.text}`}
          style={{
            fontSize: COMBAT_LOG_MINI_FONT_SIZE,
            lineHeight: COMBAT_LOG_MINI_LINE_HEIGHT,
            color: logEntryColor(entry.type),
          }}
        >
          {entry.text}
        </div>
      ))}
    </div>
  );
}

function MapDisplay({
  map,
  useSprites,
}: {
  map: GameView['map'];
  useSprites: boolean;
}) {
  const [vpTilesWidth, setVpTilesWidth] = useState(VP_WIDTH);
  const [vpTilesHeight, setVpTilesHeight] = useState(VP_HEIGHT);
  const displayContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateViewport = () => {
      const container = displayContainerRef.current;
      if (container === null) return;

      const cellSize = 24;
      const availableWidth = container.offsetWidth;
      const availableHeight = container.offsetHeight;

      setVpTilesWidth(Math.max(15, Math.floor(availableWidth / cellSize)));
      setVpTilesHeight(Math.max(12, Math.floor(availableHeight / cellSize)));
    };

    calculateViewport();
    window.addEventListener('resize', calculateViewport);
    const resizeObserver = new ResizeObserver(() => calculateViewport());
    if (displayContainerRef.current !== null) {
      resizeObserver.observe(displayContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateViewport);
      resizeObserver.disconnect();
    };
  }, []);

  const { vpLeft, vpTop } = useMemo(() => {
    if (map === null) return { vpLeft: 0, vpTop: 0 };

    const minX = Math.min(...map.cells.map((cell) => cell.x));
    const minY = Math.min(...map.cells.map((cell) => cell.y));
    return {
      vpLeft: Math.max(minX, map.playerPosition.x - Math.floor(vpTilesWidth / 2)),
      vpTop: Math.max(minY, map.playerPosition.y - Math.floor(vpTilesHeight / 2)),
    };
  }, [map, vpTilesHeight, vpTilesWidth]);

  if (map === null) return null;

  const canvasPxWidth = vpTilesWidth * 24;
  const canvasPxHeight = vpTilesHeight * 24;
  const cellSize = 24;

  return (
    <>
      <div style={{ fontSize: 13, color: dangerColor(map.dangerLevel), marginBottom: 4 }}>
        Danger: {map.dangerLevel.charAt(0).toUpperCase() + map.dangerLevel.slice(1)}
      </div>
      <div
        ref={displayContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          marginBottom: 8,
          imageRendering: 'pixelated' as const,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          position: 'relative',
        }}
      >
        <div style={{ width: canvasPxWidth, height: canvasPxHeight, position: 'relative' }}>
          {useSprites
            ? <DungeonCanvas map={map} vpTilesWidth={vpTilesWidth} vpTilesHeight={vpTilesHeight} />
            : <DungeonView map={map} vpTilesWidth={vpTilesWidth} vpTilesHeight={vpTilesHeight} />}
          <BumpAnimations />
          <CombatIndicators
            vpLeft={vpLeft}
            vpTop={vpTop}
            cellSize={cellSize}
            fadeOutDuration={COMBAT_INDICATOR_FADEOUT_MS}
          />
        </div>
      </div>
    </>
  );
}

export function DungeonPhase({
  view,
  combatLog,
  loading,
  error,
  sendCommand,
  useSprites,
  setUseSprites,
}: DungeonPhaseProps) {
  void loading;

  const { isMobile } = useBreakpoint();
  const [showInspectModal, setShowInspectModal] = useState(false);
  useAnimationOrchestrator(view.animatedEvents);

  const equippedWeapon = view.inventory.equipped.weapon;
  const damageDisplay = `${view.player.totalDamageMin}–${view.player.totalDamageMax}`;
  const weaponDisplay = equippedWeapon !== null ? `[${equippedWeapon.name}] ${damageDisplay}` : `Unarmed ${damageDisplay}`;
  const miniLogHeight = Math.ceil(
    COMBAT_LOG_MINI_FONT_SIZE * COMBAT_LOG_MINI_LINE_HEIGHT * COMBAT_LOG_MINI_ENTRIES,
  ) + 8;

  const sharedContent = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#88cc44', fontSize: isMobile ? 18 : 20 }}>Dungeon</h2>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <ItemSpriteIcon spriteName={equippedWeapon?.spriteName} size={16} />
            <span style={{ fontSize: isMobile ? 13 : 14, color: '#aaa' }}>{weaponDisplay}</span>
          </div>
        </div>
        {view.map !== null && (
          <button
            onClick={() => setUseSprites((current) => !current)}
            style={{
              fontSize: isMobile ? 10 : 11,
              padding: isMobile ? '2px 6px' : '2px 8px',
              background: '#333',
              color: '#aaa',
              border: '1px solid #555',
              cursor: 'pointer',
            }}
          >
            {useSprites ? (isMobile ? '🎨' : '🎨 Sprites') : (isMobile ? '⬛' : '⬛ ASCII')}
          </button>
        )}
      </div>

      <div style={{ flexShrink: 0, marginBottom: isMobile ? 6 : 8 }}>
        <PlayerHud player={view.player} compact />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: isMobile ? 6 : 8 }}>
        <MapDisplay map={view.map} useSprites={useSprites} />
      </div>

      <div style={{ flexShrink: 0, height: miniLogHeight, borderTop: '1px solid #222', paddingTop: 4, marginBottom: isMobile ? 6 : 8 }}>
        <MiniCombatLog entries={combatLog} debugMode={view.debugMode} />
      </div>

      <div style={{ flexShrink: 0 }}>
        <UnifiedActionPanel
          view={view}
          onSendCommand={sendCommand}
          onInspectOpen={() => setShowInspectModal(true)}
        />
      </div>

      {showInspectModal && view.inspectableEntities.length > 0 && (
        <InspectModal
          entities={view.inspectableEntities}
          playerSpeed={view.player.speed}
          useSprites={useSprites}
          onClose={() => setShowInspectModal(false)}
        />
      )}

      {error !== null && (
        <p style={{ color: '#f44', fontSize: isMobile ? 10 : undefined, margin: isMobile ? '4px 0 0 0' : '8px 0 0 0' }}>
          {error}
        </p>
      )}

      {import.meta.env.VITE_DEBUG === 'true' && <DebugPanel />}
    </>
  );

  return (
    <div
      style={{
        padding: 8,
        fontFamily: 'monospace',
        color: '#ccc',
        background: '#111',
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        paddingBottom: TAB_BAR_HEIGHT + 8,
      }}
    >
      {sharedContent}
    </div>
  );
}
