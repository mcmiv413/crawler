/// <reference types="@testing-library/jest-dom" />

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';

const {
  sendCommandSpy,
  startAutoWalkSpy,
  cancelTileTargetingSpy,
  tileTargetModeState,
} = vi.hoisted(() => ({
  sendCommandSpy: vi.fn(),
  startAutoWalkSpy: vi.fn(),
  cancelTileTargetingSpy: vi.fn(),
  tileTargetModeState: {
    current: { active: false, selectedAbilityId: null as string | null },
  },
}));

vi.mock('../utils/pathfinding.js', () => ({
  findPath: vi.fn(() => []),
}));

vi.mock('../store/game-store.js', () => ({
  useGameStore: {
    getState: () => ({
      tileTargetMode: tileTargetModeState.current,
      sendCommand: sendCommandSpy,
      startAutoWalk: startAutoWalkSpy,
      cancelTileTargeting: cancelTileTargetingSpy,
    }),
  },
}));

import { findPath } from '../utils/pathfinding.js';
import { DungeonView } from './DungeonView.js';

function createCell(
  x: number,
  y: number,
  ascii: string,
  walkable = true,
  visibility: MapView['cells'][number]['visibility'] = 'visible',
): MapView['cells'][number] {
  return {
    x,
    y,
    ascii,
    color: '#aaa',
    bgColor: '#000',
    visibility,
    walkable,
    tileType: walkable ? 'floor' : 'wall',
  };
}

const baseMap: MapView = {
  width: 3,
  height: 3,
  biomeId: 'dungeon',
  dangerLevel: 'moderate',
  playerPosition: { x: 1, y: 1 },
  cells: [
    createCell(0, 0, 'A'),
    createCell(1, 0, 'B'),
    createCell(2, 0, 'C'),
    createCell(0, 1, 'D'),
    createCell(1, 1, 'E'),
    createCell(2, 1, 'F'),
    createCell(0, 2, 'G'),
    createCell(1, 2, 'H'),
    createCell(2, 2, 'I'),
  ],
  entities: [],
};

describe('DungeonView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tileTargetModeState.current = { active: false, selectedAbilityId: null };
    vi.mocked(findPath).mockReturnValue([]);
  });

  it('starts auto-walk when clicking a reachable tile outside tile-target mode', () => {
    const path = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
    vi.mocked(findPath).mockReturnValue(path);

    render(<DungeonView map={baseMap} vpTilesWidth={3} vpTilesHeight={3} />);
    fireEvent.click(screen.getByText('F'));

    expect(findPath).toHaveBeenCalledWith(baseMap, baseMap.playerPosition, { x: 2, y: 1 });
    expect(startAutoWalkSpy).toHaveBeenCalledWith(path);
    expect(sendCommandSpy).not.toHaveBeenCalled();
  });

  it('casts the selected tile-target ability instead of auto-walking', () => {
    tileTargetModeState.current = { active: true, selectedAbilityId: 'thunder_step' };

    render(<DungeonView map={baseMap} vpTilesWidth={3} vpTilesHeight={3} />);
    fireEvent.click(screen.getByText('F'));

    expect(sendCommandSpy).toHaveBeenCalledWith({
      type: 'USE_ABILITY',
      abilityId: 'thunder_step',
      targetPosition: { x: 2, y: 1 },
    });
    expect(cancelTileTargetingSpy).toHaveBeenCalledTimes(1);
    expect(findPath).not.toHaveBeenCalled();
    expect(startAutoWalkSpy).not.toHaveBeenCalled();
  });

  it('keeps tile-targeting active on remembered tiles', () => {
    tileTargetModeState.current = { active: true, selectedAbilityId: 'thunder_step' };
    const map = {
      ...baseMap,
      cells: baseMap.cells.map((cell) =>
        cell.x === 2 && cell.y === 1
          ? createCell(cell.x, cell.y, cell.ascii, cell.walkable, 'remembered')
          : cell,
      ),
    };

    render(<DungeonView map={map} vpTilesWidth={3} vpTilesHeight={3} />);
    fireEvent.click(screen.getByText('F'));

    expect(sendCommandSpy).not.toHaveBeenCalled();
    expect(cancelTileTargetingSpy).not.toHaveBeenCalled();
    expect(findPath).not.toHaveBeenCalled();
  });

  it('keeps tile-targeting active on the player current tile', () => {
    tileTargetModeState.current = { active: true, selectedAbilityId: 'thunder_step' };

    render(<DungeonView map={baseMap} vpTilesWidth={3} vpTilesHeight={3} />);
    fireEvent.click(screen.getByText('E'));

    expect(sendCommandSpy).not.toHaveBeenCalled();
    expect(cancelTileTargetingSpy).not.toHaveBeenCalled();
    expect(findPath).not.toHaveBeenCalled();
  });

  it('cancels tile targeting when Escape is pressed', () => {
    tileTargetModeState.current = { active: true, selectedAbilityId: 'thunder_step' };

    render(<DungeonView map={baseMap} vpTilesWidth={3} vpTilesHeight={3} />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(cancelTileTargetingSpy).toHaveBeenCalledTimes(1);
  });
});
