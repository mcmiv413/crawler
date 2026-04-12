import React, { useState, useEffect } from 'react';
import type { GameView, AvailableAction, QuestView } from '@dungeon/presenter';
import { VIEWPORT_PX_WIDTH, VIEWPORT_PX_HEIGHT } from '../utils/viewport.js';
import { ACTIONS_COLUMN_MIN_WIDTH, CONSUMABLES_BAR_MAX_HEIGHT, QUEST_TRACKER_MAX_HEIGHT } from '../config/ui-config.js';
import { btnStyle } from '../styles.js';
import { PlayerHud } from './PlayerHud.js';
import { DungeonView } from './DungeonView.js';
import { DungeonCanvas } from './DungeonCanvas.js';
import { CombatLogView } from './CombatLogView.js';
import { InventoryPanel } from './InventoryPanel.js';
import { DebugPanel } from './DebugPanel.js';
import { useBreakpoint } from '../hooks/useBreakpoint.js';

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
      {recent.map((e, i) => (
        <div
          key={i}
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

function ConsumablesBar({
  actions,
  loading,
  handleClick,
}: {
  actions: readonly AvailableAction[];
  loading: boolean;
  handleClick: (action: AvailableAction) => void;
}) {
  const [open, setOpen] = useState(true);
  const items = actions.filter((a: AvailableAction) => a.type === 'item');
  if (items.length === 0) return null;

  // Group items by label to show stacks
  const itemStacks = Array.from(
    items.reduce((map, action) => {
      const existing = map.get(action.label);
      if (existing) {
        existing.count++;
      } else {
        map.set(action.label, { action, count: 1 });
      }
      return map;
    }, new Map<string, { action: AvailableAction; count: number }>()).values()
  );

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 10,
          padding: '4px 8px',
          background: '#333',
          color: '#aaa',
          border: '1px solid #555',
          cursor: 'pointer',
        }}
      >
        Items ({itemStacks.length}) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ maxHeight: CONSUMABLES_BAR_MAX_HEIGHT, overflowY: 'auto' as const }}>
          {itemStacks.map(({ action, count }) => (
            <div key={action.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', alignItems: 'center' }}>
              <span style={{ fontSize: 11 }}>
                {action.label}
                {count > 1 && <span style={{ color: '#8cf', marginLeft: 4 }}>×{count}</span>}
              </span>
              <button
                onClick={() => handleClick(action)}
                disabled={!action.enabled || loading}
                style={{ ...btnStyle, fontSize: 10, padding: '2px 6px' }}
              >
                Use
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButtonGrid({
  actions,
  loading,
  handleClick,
}: {
  actions: readonly AvailableAction[];
  loading: boolean;
  handleClick: (action: AvailableAction) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {actions
        .filter((a: AvailableAction) => ['attack', 'retreat', 'interact', 'ascend', 'ability', 'wait'].includes(a.type))
        .map((action: AvailableAction) => (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
            style={action.type === 'ability' ? { ...btnStyle, color: '#6af', borderColor: '#2a4a7a' } : btnStyle}
            disabled={!action.enabled || loading}
            title={action.description}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

function QuestTracker({ quests }: { quests: readonly QuestView[] }) {
  const [open, setOpen] = useState(false);
  const active = quests.filter(q => q.status === 'active');
  if (active.length === 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 10,
          padding: '4px 8px',
          background: '#333',
          color: '#aaa',
          border: '1px solid #555',
          cursor: 'pointer',
        }}
      >
        📜 Quests ({active.length}) {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ maxHeight: QUEST_TRACKER_MAX_HEIGHT, overflowY: 'auto' as const }}>
          {active.map(q => (
            <div key={q.id} style={{ padding: '6px 0', borderBottom: '1px solid #1a2a1a' }}>
              <div style={{ fontSize: 11, color: '#88bb88' }}>{q.title}</div>
              <div style={{ fontSize: 10, color: '#666' }}>{q.description}</div>
              <div style={{ fontSize: 10, color: '#cc8844' }}>Reward: {q.rewardGold}g</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MapDisplay({
  map,
  mapScale,
  useSprites,
}: {
  map: any;
  mapScale: number;
  useSprites: boolean;
}) {
  if (!map) return null;

  return (
    <>
      <div style={{ fontSize: 11, color: dangerColor(map.dangerLevel), marginBottom: 4 }}>
        Danger: {map.dangerLevel.charAt(0).toUpperCase() + map.dangerLevel.slice(1)}
      </div>
      <div style={{ width: VIEWPORT_PX_WIDTH * mapScale, height: VIEWPORT_PX_HEIGHT * mapScale, overflow: 'hidden', flexShrink: 0, marginBottom: 8, imageRendering: 'pixelated' as const }}>
        <div style={{ transform: `scale(${mapScale})`, transformOrigin: 'top left', width: VIEWPORT_PX_WIDTH, height: VIEWPORT_PX_HEIGHT }}>
          {useSprites ? <DungeonCanvas map={map} /> : <DungeonView map={map} />}
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
  const [mapScale, setMapScale] = useState(1);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);

  // Calculate map scale to fit available width
  useEffect(() => {
    const updateScale = () => {
      if (isMobile) {
        // Mobile: scale down if needed to fit window width
        const padding = 16;
        setMapScale(Math.min(1, (window.innerWidth - padding) / VIEWPORT_PX_WIDTH));
      } else {
        // Desktop: scale up to fill available left-column width
        const container = mapContainerRef.current?.parentElement;
        if (container) {
          const availableWidth = container.offsetWidth;
          const MAX_SCALE = 2.0;
          const scale = Math.min(MAX_SCALE, Math.max(0.5, availableWidth / VIEWPORT_PX_WIDTH));
          setMapScale(scale);
        } else {
          setMapScale(1);
        }
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const resizeObserver = new ResizeObserver(() => updateScale());
    if (mapContainerRef.current?.parentElement) {
      resizeObserver.observe(mapContainerRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      resizeObserver.disconnect();
    };
  }, [isMobile]);

  const handleActionClick = (action: AvailableAction) => {
    if (action.type === 'attack' && action.targetId) {
      sendCommand({ type: 'ATTACK', targetId: action.targetId });
    } else if (action.type === 'retreat') {
      sendCommand({ type: 'RETREAT' });
    } else if (action.type === 'interact' && action.targetPosition) {
      sendCommand({ type: 'INTERACT', targetPosition: action.targetPosition });
    } else if (action.type === 'ascend') {
      sendCommand({ type: 'ASCEND' });
    } else if (action.type === 'wait') {
      sendCommand({ type: 'WAIT' });
    } else if (action.type === 'ability') {
      const abilityId = action.id.replace('use_ability_', '');
      sendCommand({ type: 'USE_ABILITY', abilityId, targetId: action.targetId });
    } else if (action.type === 'item' && action.targetId) {
      const isUse = action.id.startsWith('use_');
      const itemId = action.id.replace(isUse ? 'use_' : 'equip_', '');
      sendCommand({ type: isUse ? 'USE_ITEM' : 'EQUIP', itemId });
    }
  };


  return (
    <div style={{ padding: 8, fontFamily: 'monospace', color: '#ccc', background: '#111', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, color: '#88cc44' }}>Dungeon</h2>
        {view.map && (
          <button
            onClick={() => setUseSprites(s => !s)}
            style={{ fontSize: 11, padding: '2px 8px', background: '#333', color: '#aaa', border: '1px solid #555', cursor: 'pointer' }}
          >
            {useSprites ? '🎨 Sprites' : '⬛ ASCII'}
          </button>
        )}
      </div>
      <PlayerHud player={view.player} compact />
      <MapDisplay map={view.map} mapScale={mapScale} useSprites={useSprites} />
      {view.inventory.equipped.secondaryWeapon && (
        <button
          onClick={() => sendCommand({ type: 'SWAP_WEAPONS' })}
          style={{ ...btnStyle, background: '#2a2a44', color: '#8af', marginTop: 8, width: '100%' }}
          disabled={loading}
        >
          ⚔ Swap to {view.inventory.equipped.secondaryWeapon.name}
        </button>
      )}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Actions</div>
        <ActionButtonGrid actions={view.availableActions} loading={loading} handleClick={handleActionClick} />
        <ConsumablesBar actions={view.availableActions} loading={loading} handleClick={handleActionClick} />
        <QuestTracker quests={view.activeQuests} />
      </div>
      <MiniCombatLog entries={combatLog} />
      {error && <p style={{ color: '#f44' }}>{error}</p>}
      {import.meta.env.VITE_DEBUG === 'true' && <DebugPanel />}
    </div>
  );
}
