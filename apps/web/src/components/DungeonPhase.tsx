import React, { useState, useEffect } from 'react';
import type { GameView, CombatIndicatorEntry } from '@dungeon/presenter';
import { VP_WIDTH, VP_HEIGHT } from '../utils/viewport.js';
import { TAB_BAR_HEIGHT, COMBAT_INDICATOR_DURATION_MS } from '../config/ui-config.js';
import { PlayerHud } from './PlayerHud.js';
import { DungeonView } from './DungeonView.js';
import { DungeonCanvas } from './DungeonCanvas.js';
import { CombatLogView } from './CombatLogView.js';
import { InventoryPanel } from './InventoryPanel.js';
import { DebugPanel } from './DebugPanel.js';
import { UnifiedActionPanel } from './UnifiedActionPanel.js';
import { InspectModal } from './InspectModal.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { CombatIndicators } from './CombatIndicators.js';
import { useCombatIndicators } from '../hooks/useCombatIndicators.js';

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

function MiniCombatLog({ entries }: { entries: readonly { text: string; type: string }[] }) {
  const recent = entries.slice(-4);
  if (recent.length === 0) return null;
  return (
    <div style={{ marginTop: 8, borderTop: '1px solid #222', paddingTop: 4 }}>
      {recent.map((e, index) => (
        <div
          key={`${index}-${e.type}-${e.text}`}
          style={{
            fontSize: 10,
            lineHeight: 1.3,
            color: e.type === 'loot' ? '#4f4' : e.type === 'death' ? '#f44' : '#aaa',
          }}
        >
          {e.text}
        </div>
      ))}
    </div>
  );
}

function MapDisplay({
  map,
  useSprites,
  containerRef,
  combatIndicators,
}: {
  map: any;
  useSprites: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  combatIndicators?: readonly CombatIndicatorEntry[];
}) {
  const [vpTilesWidth, setVpTilesWidth] = useState(VP_WIDTH);
  const [vpTilesHeight, setVpTilesHeight] = useState(VP_HEIGHT);
  const [vpLeft, setVpLeft] = useState(0);
  const [vpTop, setVpTop] = useState(0);
  const displayContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateViewport = () => {
      const container = displayContainerRef.current;
      if (!container) return;

      const CELL_SIZE = 24;
      const availableWidth = container.offsetWidth;
      const availableHeight = container.offsetHeight;

      // Calculate how many tiles fit in available space (minimum 15x12)
      const newVpTilesWidth = Math.max(15, Math.floor(availableWidth / CELL_SIZE));
      const newVpTilesHeight = Math.max(12, Math.floor(availableHeight / CELL_SIZE));

      setVpTilesWidth(newVpTilesWidth);
      setVpTilesHeight(newVpTilesHeight);
    };

    calculateViewport();
    window.addEventListener('resize', calculateViewport);
    const resizeObserver = new ResizeObserver(() => calculateViewport());
    if (displayContainerRef.current) {
      resizeObserver.observe(displayContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateViewport);
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate viewport position for indicator positioning
  useEffect(() => {
    if (!map) return;
    const minX = Math.min(...map.cells.map((c: any) => c.x));
    const maxX = Math.max(...map.cells.map((c: any) => c.x));
    const minY = Math.min(...map.cells.map((c: any) => c.y));
    
    const newVpLeft = Math.max(minX, map.playerPosition.x - Math.floor(vpTilesWidth / 2));
    const newVpTop = Math.max(minY, map.playerPosition.y - Math.floor(vpTilesHeight / 2));
    
    setVpLeft(newVpLeft);
    setVpTop(newVpTop);
  }, [map, vpTilesWidth, vpTilesHeight]);

  // Hook to track combat indicators
  useCombatIndicators(combatIndicators ?? []);

  if (!map) return null;

  const canvasPxWidth = vpTilesWidth * 24;
  const canvasPxHeight = vpTilesHeight * 24;
  const CELL_SIZE = 24;

  return (
    <>
      <div style={{ fontSize: 11, color: dangerColor(map.dangerLevel), marginBottom: 4 }}>
        Danger: {map.dangerLevel.charAt(0).toUpperCase() + map.dangerLevel.slice(1)}
      </div>
      <div ref={displayContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', marginBottom: 8, imageRendering: 'pixelated' as const, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', position: 'relative' }}>
        <div style={{ width: canvasPxWidth, height: canvasPxHeight, position: 'relative' }}>
          {useSprites ? <DungeonCanvas map={map} vpTilesWidth={vpTilesWidth} vpTilesHeight={vpTilesHeight} /> : <DungeonView map={map} vpTilesWidth={vpTilesWidth} vpTilesHeight={vpTilesHeight} />}
          <CombatIndicators
            vpLeft={vpLeft}
            vpTop={vpTop}
            cellSize={CELL_SIZE}
            fadeOutDuration={COMBAT_INDICATOR_DURATION_MS}
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
  const { isMobile } = useBreakpoint();
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const [showInspectModal, setShowInspectModal] = useState(false);

  // Get equipped weapon
  const equippedWeapon = (view.player.equippedItems ?? []).find(item => item.slot === 'weapon');
  const weaponDisplay = equippedWeapon ? `[${equippedWeapon.name}]` : 'Unarmed';

  // Mobile: same layout as desktop - action panel always visible with fixed combat log
  if (isMobile) {
    return (
      <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: TAB_BAR_HEIGHT + 8 }}>
        {/* Header: always visible */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: '#88cc44', fontSize: 16 }}>Dungeon</h2>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <ItemSpriteIcon spriteName={equippedWeapon?.spriteName} size={16} />
              <span style={{ fontSize: 11, color: '#aaa' }}>{weaponDisplay}</span>
            </div>
          </div>
          {view.map && (
            <button
              onClick={() => setUseSprites(s => !s)}
              style={{ fontSize: 10, padding: '2px 6px', background: '#333', color: '#aaa', border: '1px solid #555', cursor: 'pointer' }}
            >
              {useSprites ? '🎨' : '⬛'}
            </button>
          )}
        </div>

        {/* Player HUD: always visible */}
        <div style={{ flexShrink: 0, marginBottom: 6 }}>
          <PlayerHud player={view.player} compact />
        </div>

        {/* Dungeon map: dynamically sized above combat log */}
        <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: 6 }}>
          <MapDisplay map={view.map} useSprites={useSprites} containerRef={mapContainerRef} combatIndicators={view.combatIndicators ?? []} />
        </div>

        {/* Combat log: fixed 4 lines, always visible above action panel */}
        <div style={{ flexShrink: 0, minHeight: 64, maxHeight: 80, borderTop: '1px solid #222', paddingTop: 4, marginBottom: 6, overflow: 'hidden' }}>
          <MiniCombatLog entries={combatLog} />
        </div>

        {/* Action panel: always visible at bottom */}
        <div style={{ flexShrink: 0 }}>
          <UnifiedActionPanel
            view={view}
            onSendCommand={sendCommand}
            onInspectOpen={() => setShowInspectModal(true)}
          />
        </div>

        {/* Inspect modal overlay */}
        {showInspectModal && view.inspectableEntities && (
          <InspectModal
            entities={view.inspectableEntities}
            playerSpeed={view.player.speed}
            useSprites={useSprites}
            onClose={() => setShowInspectModal(false)}
          />
        )}

        {/* Error message */}
        {error && <p style={{ color: '#f44', fontSize: 10, margin: '4px 0 0 0' }}>{error}</p>}

        {import.meta.env.VITE_DEBUG === 'true' && <DebugPanel />}
      </div>
    );
  }

  // Desktop: new layout with always-visible action panel and dynamic dungeon
  return (
    <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: TAB_BAR_HEIGHT + 8 }}>
      {/* Header: always visible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#88cc44' }}>Dungeon</h2>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <ItemSpriteIcon spriteName={equippedWeapon?.spriteName} size={16} />
            <span style={{ fontSize: 11, color: '#aaa' }}>{weaponDisplay}</span>
          </div>
        </div>
        {view.map && (
          <button
            onClick={() => setUseSprites(s => !s)}
            style={{ fontSize: 11, padding: '2px 8px', background: '#333', color: '#aaa', border: '1px solid #555', cursor: 'pointer' }}
          >
            {useSprites ? '🎨 Sprites' : '⬛ ASCII'}
          </button>
        )}
      </div>

      {/* Player HUD: always visible */}
      <div style={{ flexShrink: 0, marginBottom: 6 }}>
        <PlayerHud player={view.player} compact />
      </div>

      {/* Dungeon map: dynamically sized above combat log */}
      <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
        <MapDisplay map={view.map} useSprites={useSprites} containerRef={mapContainerRef} combatIndicators={view.combatIndicators ?? []} />
      </div>

      {/* Combat log: fixed 4 lines, always visible above action panel */}
      <div style={{ flexShrink: 0, minHeight: 64, maxHeight: 80, borderTop: '1px solid #222', paddingTop: 4, marginBottom: 8, overflow: 'hidden' }}>
        <MiniCombatLog entries={combatLog} />
      </div>

      {/* Action panel: always visible at bottom */}
      <div style={{ flexShrink: 0 }}>
        <UnifiedActionPanel
          view={view}
          onSendCommand={sendCommand}
          onInspectOpen={() => setShowInspectModal(true)}
        />
      </div>

      {/* Inspect modal overlay */}
      {showInspectModal && view.inspectableEntities && (
        <InspectModal
          entities={view.inspectableEntities}
          playerSpeed={view.player.speed}
          useSprites={useSprites}
          onClose={() => setShowInspectModal(false)}
        />
      )}

      {/* Error message */}
      {error && <p style={{ color: '#f44', flexShrink: 0, marginTop: 8 }}>{error}</p>}

      {import.meta.env.VITE_DEBUG === 'true' && <DebugPanel />}
    </div>
  );
}
