import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ANIMATION_REF_BY_ID, type AnimationId } from '@dungeon/content';
import type { GameView } from '@dungeon/presenter';
import {
  CELL_SIZE,
  COMBAT_INDICATOR_FADEOUT_MS,
  COMBAT_LOG_MINI_FONT_SIZE,
  COMBAT_LOG_MINI_LINE_HEIGHT,
  COMBAT_LOG_MINI_ENTRIES,
  MIN_VIEWPORT_TILES_HEIGHT,
  MIN_VIEWPORT_TILES_WIDTH,
} from '../config/ui-config.js';
import { PlayerHud } from './PlayerHud.js';
import { DungeonView } from './DungeonView.js';
import { DungeonCanvas } from './DungeonCanvas.js';
import { ThreeAnimationOverlay } from './ThreeAnimationOverlay.js';
import { DebugPanel } from './DebugPanel.js';
import { UnifiedActionPanel } from './UnifiedActionPanel.js';
import { InspectModal } from './InspectModal.js';
import { ItemSpriteIcon } from './ItemSpriteIcon.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';
import { CombatIndicators } from './CombatIndicators.js';
import { BumpAnimations } from './BumpAnimations.js';
import { useAnimationOrchestrator } from '../animation-runtime/useAnimationOrchestrator.js';
import { useDungeonRenderState } from '../hooks/useDungeonRenderState.js';
import { useCombatIndicatorState } from '../hooks/useCombatIndicatorState.js';
import { useDefenderHitState } from '../hooks/useDefenderHitState.js';
import { useThreeAnimationOwnership } from '../hooks/useThreeAnimationOwnership.js';
import {
  getAnimationRendererMode,
  isDepthAtmosphereEnabledFlag,
} from '../config/feature-flags.js';
import { filterCombatLogForDisplay } from './combat-log-filter.js';
import { logEntryColor } from '../styles.js';
import { reportDungeonE2EReady } from '../testing/e2e-reporter.js';

interface DungeonPhaseProps {
  view: GameView;
  combatLog: readonly { text: string; type: string }[];
  loading: boolean;
  error: string | null;
  sendCommand: (command: unknown) => Promise<void>;
  useSprites: boolean;
  setUseSprites: React.Dispatch<React.SetStateAction<boolean>>;
}

const EMPTY_THREE_OWNERSHIP = {
  animationIds: [],
  entityIds: [],
  statusPresentation: false,
  combatIndicators: false,
} as const;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const filtered = filterCombatLogForDisplay(entries, debugMode);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length]);

  if (filtered.length === 0) return null;

  return (
    <div
      data-testid="combat-log"
      className="combat-log"
      ref={scrollRef}
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        borderTop: '1px solid #222',
        paddingTop: 4,
      }}
    >
      {filtered.map((entry, index) => (
        <div
          key={`${entry.type}-${entry.text}`}
          data-testid="combat-log-entry"
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
  const [vpTilesWidth, setVpTilesWidth] = useState(MIN_VIEWPORT_TILES_WIDTH);
  const [vpTilesHeight, setVpTilesHeight] = useState(MIN_VIEWPORT_TILES_HEIGHT);
  const displayContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateViewport = () => {
      const container = displayContainerRef.current;
      if (container === null) return;

      const cellSize = CELL_SIZE;
      const availableWidth = container.offsetWidth;
      const availableHeight = container.offsetHeight;

      const newW = Math.max(MIN_VIEWPORT_TILES_WIDTH, Math.floor(availableWidth / cellSize));
      const newH = Math.max(MIN_VIEWPORT_TILES_HEIGHT, Math.floor(availableHeight / cellSize));
      setVpTilesWidth((prev) => (prev === newW ? prev : newW));
      setVpTilesHeight((prev) => (prev === newH ? prev : newH));
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

  // map can be null at the top level; guard before calling hook (hooks must not be conditional)
  // We call the hook with a stable fallback so hooks are always called in the same order.
  const safeMap = map ?? { cells: [], playerPosition: { x: 0, y: 0 }, entities: [], width: 0, height: 0, biomeId: '', dangerLevel: 'safe' as const };
  const renderState = useDungeonRenderState(safeMap, vpTilesWidth, vpTilesHeight);
  const rendererMode = getAnimationRendererMode();
  const combatIndicatorLabels = useCombatIndicatorState(COMBAT_INDICATOR_FADEOUT_MS);
  const defenderHits = useDefenderHitState();
  const {
    ownedAnimationIds,
    ownedEntityIds,
    statusPresentationOwnedByThree,
    combatIndicatorsOwnedByThree,
    reportOwnership,
  } = useThreeAnimationOwnership();
  const hasResolvableThreeAnimation = useMemo(
    () => {
      const hasKnownAnimationId = (animationId: string | undefined): animationId is AnimationId =>
        animationId !== undefined && ANIMATION_REF_BY_ID.has(animationId as AnimationId);

      return (
        renderState.consumableAnimations.some((animation) => hasKnownAnimationId(animation.animationId))
        || renderState.fxAnimations.some((animation) => hasKnownAnimationId(animation.animationId))
        || renderState.statusPresentations.some((presentation) => hasKnownAnimationId(presentation.animationId))
      );
    },
    [renderState.consumableAnimations, renderState.fxAnimations, renderState.statusPresentations],
  );
  const atmosphereEnabled = isDepthAtmosphereEnabledFlag();
  const shouldRenderThreeOverlay = useSprites
    && rendererMode === 'three'
    && map !== null
    && (
      hasResolvableThreeAnimation
      || renderState.moveAnimations.length > 0
      || renderState.bumpAnimations.length > 0
      || defenderHits.size > 0
      || combatIndicatorLabels.length > 0
      || atmosphereEnabled
    );

  useEffect(() => {
    const frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        reportDungeonE2EReady(true);
      });
    });
    let frameTwo = -1;

    return () => {
      window.cancelAnimationFrame(frameOne);
      if (frameTwo >= 0) {
        window.cancelAnimationFrame(frameTwo);
      }
      reportDungeonE2EReady(false);
    };
  }, []);

  useEffect(() => {
    if (shouldRenderThreeOverlay) {
      return;
    }

    reportOwnership(EMPTY_THREE_OWNERSHIP);
  }, [reportOwnership, shouldRenderThreeOverlay]);

  if (map === null) return null;

  const canvasPxWidth = vpTilesWidth * CELL_SIZE;
  const canvasPxHeight = vpTilesHeight * CELL_SIZE;
  const cellSize = CELL_SIZE;
  const displayMap = renderState.displayMap;
  const ownedAnimationIdSet = new Set<string>(ownedAnimationIds);
  const ownedEntityIdSet = new Set<string>(ownedEntityIds);
  const canvasMap = ownedEntityIdSet.size === 0
    ? displayMap
    : {
        ...displayMap,
        entities: displayMap.entities.filter((entity) => !ownedEntityIdSet.has(entity.id)),
      };
  const canvasStatusPresentations = renderState.statusPresentations.filter(
    (presentation) =>
      presentation.animationId === undefined
      || !ownedAnimationIdSet.has(presentation.animationId as AnimationId),
  );

  return (
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
      <div
        data-testid="dungeon-map-container"
        style={{ width: canvasPxWidth, height: canvasPxHeight, position: 'relative' }}
      >
        {useSprites
          ? (
            <DungeonCanvas
              map={canvasMap}
              vpTilesWidth={vpTilesWidth}
              vpTilesHeight={vpTilesHeight}
              bumpAnimations={renderState.bumpAnimations}
              moveAnimations={renderState.moveAnimations}
              consumableAnimations={renderState.consumableAnimations}
              fxAnimations={renderState.fxAnimations}
              statusPresentations={canvasStatusPresentations}
              vpLeft={renderState.vpLeft}
              vpTop={renderState.vpTop}
              cameraOffset={renderState.cameraOffset}
              skipHandledAnimationIds={ownedAnimationIds}
            />
          )
          : <DungeonView map={displayMap} vpTilesWidth={vpTilesWidth} vpTilesHeight={vpTilesHeight} />}
        {shouldRenderThreeOverlay && (
          <ThreeAnimationOverlay
            map={displayMap}
            isEnabled={true}
            atmosphereEnabled={atmosphereEnabled}
            vpTilesWidth={vpTilesWidth}
            vpTilesHeight={vpTilesHeight}
            bumpAnimations={renderState.bumpAnimations}
            moveAnimations={renderState.moveAnimations}
            consumableAnimations={renderState.consumableAnimations}
            fxAnimations={renderState.fxAnimations}
            statusPresentations={renderState.statusPresentations}
            combatIndicators={combatIndicatorLabels}
            defenderHits={defenderHits}
            vpLeft={renderState.vpLeft}
            vpTop={renderState.vpTop}
            cameraOffset={renderState.cameraOffset}
            style={{ pointerEvents: 'none' }}
            onOwnershipChange={reportOwnership}
          />
        )}
        <BumpAnimations />
        {!combatIndicatorsOwnedByThree && (
          <CombatIndicators
            vpLeft={renderState.vpLeft}
            vpTop={renderState.vpTop}
            cellSize={cellSize}
            fadeOutDuration={COMBAT_INDICATOR_FADEOUT_MS}
            labels={combatIndicatorLabels}
          />
        )}
      </div>
    </div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, color: '#88cc44', fontSize: isMobile ? 18 : 20 }}>Dungeon</h2>
          {view.map !== null && (
            <span
              data-testid="danger-indicator"
              style={{
                fontSize: isMobile ? 10 : 11,
                color: dangerColor(view.map.dangerLevel),
                padding: isMobile ? '1px 5px' : '2px 6px',
                border: `1px solid ${dangerColor(view.map.dangerLevel)}`,
                background: '#161616',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              Danger: {view.map.dangerLevel.charAt(0).toUpperCase() + view.map.dangerLevel.slice(1)}
            </span>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>
            <ItemSpriteIcon spriteName={equippedWeapon?.spriteName} size={16} />
            <span
              style={{
                fontSize: isMobile ? 13 : 14,
                color: '#aaa',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {weaponDisplay}
            </span>
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

      <div style={{ flexShrink: 0, height: miniLogHeight, minHeight: miniLogHeight, marginBottom: isMobile ? 6 : 8 }}>
        <MiniCombatLog entries={combatLog} debugMode={view.debugMode} />
      </div>

      <div style={{ flexShrink: 0 }}>
        <UnifiedActionPanel
          view={view}
          loading={loading}
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
      data-testid="dungeon-view"
      className="dungeon-phase"
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
      }}
    >
      {sharedContent}
    </div>
  );
}
