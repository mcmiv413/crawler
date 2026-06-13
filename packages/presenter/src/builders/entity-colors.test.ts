import { describe, it, expect } from 'vitest';
import { posKey } from '@dungeon/contracts';
import type { EnemyInstance, GameState } from '@dungeon/contracts';
import { createTestEnemy, createTestGameStateInCombat } from '@dungeon/core/testing';
import { DEFAULT_ENEMY_COLOR, getDamageTypeColor, getEnemyColor } from './entity-colors.js';
import { buildMapView } from './map-view-builder.js';
import { buildGameView } from '../game-view-builder.js';

function makeEnemy(overrides?: Partial<EnemyInstance>): EnemyInstance {
  return createTestEnemy({ position: { x: 1, y: 0 }, ...overrides });
}

function makeStateWithEnemy(enemy: EnemyInstance): GameState {
  const base = createTestGameStateInCombat();
  const key = posKey(enemy.position);
  const visibleCell = {
    tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#fff' },
    visibility: 'visible' as const,
  };
  return {
    ...base,
    run: {
      ...base.run!,
      enemies: new Map([[key, enemy]]),
      floor: {
        ...base.run!.floor,
        cells: new Map([
          [key, visibleCell],
          [posKey(base.player.position), visibleCell],
        ]),
      },
    },
  };
}

describe('entity colors (shared presenter color source)', () => {
  it('prefers the template-provided enemy color', () => {
    const enemy = makeEnemy({ color: '#123456' });
    expect(getEnemyColor(enemy)).toBe('#123456');
  });

  it('covers arcane and shadow damage types distinctly from the default', () => {
    expect(getDamageTypeColor('arcane')).not.toBe(DEFAULT_ENEMY_COLOR);
    expect(getDamageTypeColor('shadow')).not.toBe(DEFAULT_ENEMY_COLOR);
    expect(getDamageTypeColor('physical')).toBe(DEFAULT_ENEMY_COLOR);
  });

  it('map view and game view expose the same color for a template-colored enemy', () => {
    const enemy = makeEnemy({
      color: '#123456',
      equipment: { weapon: { damageMultiplier: 1.0, damageType: 'arcane', weaponRange: 1 } },
    });
    const state = makeStateWithEnemy(enemy);

    const mapEntity = buildMapView(state)?.entities.find(entity => entity.id === enemy.id);
    const inspectEntity = buildGameView(state).inspectableEntities.find(entity => entity.id === enemy.id);

    expect(mapEntity?.color).toBe('#123456');
    expect(inspectEntity?.color).toBe('#123456');
    expect(mapEntity?.color).toBe(inspectEntity?.color);
  });

  it('map view and game view expose the same damage-type color when no template color is set', () => {
    const enemy = makeEnemy({
      color: undefined,
      equipment: { weapon: { damageMultiplier: 1.0, damageType: 'arcane', weaponRange: 1 } },
    });
    const state = makeStateWithEnemy(enemy);

    const mapEntity = buildMapView(state)?.entities.find(entity => entity.id === enemy.id);
    const inspectEntity = buildGameView(state).inspectableEntities.find(entity => entity.id === enemy.id);

    expect(mapEntity?.color).toBe(getDamageTypeColor('arcane'));
    expect(inspectEntity?.color).toBe(getDamageTypeColor('arcane'));
    expect(mapEntity?.color).toBe(inspectEntity?.color);
  });
});
