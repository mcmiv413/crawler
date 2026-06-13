import React, { useCallback } from 'react';
import type { MapView, EntityView, MapCellView } from '@dungeon/presenter';
import { VP_WIDTH, VP_HEIGHT, CELL_SIZE } from '../config/ui-config.js';
import { findPath } from '../utils/pathfinding.js';
import { useGameStore } from '../store/game-store.js';
import { FONT_STACK, colors } from '../styles.js';

interface Props {
  map: MapView;
  vpTilesWidth?: number;
  vpTilesHeight?: number;
}

const buildPositionMap = <T extends { x: number; y: number }>(items: readonly T[]) =>
  new Map(items.map(i => [`${i.x},${i.y}`, i] as [string, T]));

export function DungeonView({ map, vpTilesWidth, vpTilesHeight }: Props) {
  const vp_width = vpTilesWidth ?? VP_WIDTH;
  const vp_height = vpTilesHeight ?? VP_HEIGHT;

  const entityMap = buildPositionMap(map.entities);

  const minX = map.cells.length > 0 ? Math.min(...map.cells.map((c: MapCellView) => c.x)) : 0;
  const minY = map.cells.length > 0 ? Math.min(...map.cells.map((c: MapCellView) => c.y)) : 0;

  const vpLeft = Math.max(minX, map.playerPosition.x - Math.floor(vp_width / 2));
  const vpTop  = Math.max(minY, map.playerPosition.y - Math.floor(vp_height / 2));

  const cellLookup = buildPositionMap(map.cells);

  // Handle ESC to cancel tile-targeting mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const store = useGameStore.getState();
        if (store.tileTargetMode.active) {
          store.cancelTileTargeting();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      const store = useGameStore.getState();
      const targetKey = `${x},${y}`;
      const cell = cellLookup.get(targetKey);
      if (!cell || cell.visibility === 'hidden') return;

      // Handle tile-target mode
      const selectedAbilityId = store.tileTargetMode.selectedAbilityId;
      if (store.tileTargetMode.active && selectedAbilityId) {
        // Tile-target mode is only entered for tile-target abilities (AbilityView.tileTarget),
        // which never target the player's own tile or an occupied tile.
        const isPlayerTile = x === map.playerPosition.x && y === map.playerPosition.y;
        const isInvalidTileTarget = isPlayerTile || entityMap.has(targetKey);
        if (cell.visibility !== 'visible' || !cell.walkable || isInvalidTileTarget) return;

        store.sendCommand({
          type: 'USE_ABILITY',
          abilityId: selectedAbilityId,
          targetPosition: { x, y },
        });
        store.cancelTileTargeting();
        return;
      }

      // Normal auto-walk mode
      if (!cell.walkable) return;

      const path = findPath(map, map.playerPosition, { x, y });
      if (path.length === 0) return;

      store.startAutoWalk(path);
    },
    [map, cellLookup, entityMap],
  );

  const rows: React.ReactNode[] = [];
  for (let y = vpTop; y < vpTop + vp_height; y++) {
    const cells: React.ReactNode[] = [];
    for (let x = vpLeft; x < vpLeft + vp_width; x++) {
      const key = `${x},${y}`;
      const cell = cellLookup.get(key);
      const entity = entityMap.get(key);

      let ascii = ' ';
      let color = '#333';
      let bgColor = '#000';

      if (cell) {
        ascii = cell.ascii;
        color = cell.color;
        bgColor = cell.bgColor;
      }

      if (entity && cell?.visibility === 'visible') {
        ascii = entity.ascii;
        color = entity.color;
      }

      cells.push(
        <span
          key={key}
          onClick={() => handleCellClick(x, y)}
          style={{
            display: 'inline-block',
            width: CELL_SIZE,
            height: CELL_SIZE,
            lineHeight: `${CELL_SIZE}px`,
            textAlign: 'center',
            color,
            backgroundColor: bgColor,
            fontFamily: FONT_STACK,
            fontSize: CELL_SIZE - 10,
            cursor: cell !== undefined && cell.walkable && cell.visibility !== 'hidden' ? 'pointer' : 'default',
            position: 'relative',
          }}
          title={entity ? `${entity.name}${entity.health != null ? ` (${entity.health}/${entity.maxHealth})` : ''}` : undefined}
        >
          {ascii}
          {entity?.instanceColor && (
            <span style={{
              position: 'absolute', top: 1, right: 1,
              width: 4, height: 4,
              backgroundColor: entity.instanceColor,
              borderRadius: 1,
            }} />
          )}
        </span>
      );
    }
    rows.push(
      <div key={y} style={{ display: 'flex', height: CELL_SIZE }}>
        {cells}
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${colors.border}`, display: 'inline-block', background: '#000' }}>
      {rows}
    </div>
  );
}
