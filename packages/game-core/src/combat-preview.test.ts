/**
 * Test layer: unit
 * Behavior: Combat preview helpers reflect equipped weapon damage, ranged hit-chance falloff, and deadly threat classification.
 * Proof: Assertions compare armed versus unarmed totalDamageMin/Max while attack stays equal, near versus far playerHitChance for a bow, and a high-speed high-attack enemy preview with isFasterThanPlayer true and threatRating "Deadly".
 * Validation: pnpm vitest run packages/game-core/src/combat-preview.test.ts
 */
import type { AnyItemTemplate, EnemyInstance } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { describe, expect, it } from 'vitest';
import { getEnemyCombatPreview, getPlayerOffensePreview } from './combat-preview.js';
import { createTestEnemy, createTestGameState, createTestRunState } from './test-utils.js';

function createWeaponTemplate(
  itemId: string,
  weaponRange: number,
  minRange = 0,
  damage = 6,
): AnyItemTemplate {
  return {
    itemId,
    name: `Weapon ${itemId}`,
    description: 'Local test weapon.',
    itemClass: 'weapon',
    rarity: 'common',
    value: 1,
    stackable: false,
    maxStack: 1,
    weapon: {
      damage,
      damageType: 'physical',
      accuracy: 0,
      speed: 100,
      slot: 'weapon',
      weaponRange,
      minRange,
      weaponType: weaponRange > 1 ? 'ranged' : 'blade',
    },
  };
}

function createDungeonState(enemy: EnemyInstance, weapon?: { id: string; template: AnyItemTemplate }) {
  const weaponEntityId = weapon ? entityId(weapon.id) : null;
  const itemRegistry = new Map();
  if (weapon) {
    itemRegistry.set(weaponEntityId, weapon.template);
  }

  return {
    ...createTestGameState({
      phase: 'dungeon',
      player: {
        position: { x: 0, y: 0 },
        equipment: {
          weapon: weaponEntityId,
          secondaryWeapon: null,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
        },
      },
    }),
    itemRegistry: { items: itemRegistry },
    run: createTestRunState({
      enemies: new Map([[`${enemy.position.x},${enemy.position.y}`, enemy]]),
    }),
  };
}

describe('combat preview helpers', () => {
  it('increases player damage preview when a weapon is equipped', () => {
    const enemy = createTestEnemy();
    const unarmedState = createDungeonState(enemy);
    const weaponState = createDungeonState(enemy, {
      id: 'test_blade',
      template: createWeaponTemplate('test_blade', 1, 0, 10),
    });

    const unarmed = getPlayerOffensePreview(unarmedState);
    const armed = getPlayerOffensePreview(weaponState);

    expect(armed.attack).toBe(unarmed.attack);
    expect(armed.totalDamageMin).toBeGreaterThan(unarmed.totalDamageMin);
    expect(armed.totalDamageMax).toBeGreaterThan(unarmed.totalDamageMax);
  });

  it('matches live ranged accuracy falloff as targets get farther away', () => {
    const nearEnemy = createTestEnemy({ position: { x: 1, y: 0 } });
    const farEnemy = createTestEnemy({ position: { x: 5, y: 0 } });
    const bow = {
      id: 'training_bow',
      template: createWeaponTemplate('training_bow', 6, 2, 8),
    };

    const nearPreview = getEnemyCombatPreview(createDungeonState(nearEnemy, bow), nearEnemy);
    const farPreview = getEnemyCombatPreview(createDungeonState(farEnemy, bow), farEnemy);

    expect(nearPreview.playerHitChance).toBeGreaterThan(farPreview.playerHitChance);
  });

  it('marks overwhelming enemies as deadly', () => {
    const boss = createTestEnemy({
      position: { x: 3, y: 0 },
      stats: {
        maxHealth: 60,
        health: 60,
        attack: 60,
        defense: 3,
        accuracy: 95,
        evasion: 15,
        speed: 180,
      },
      equipment: {
        weapon: {
          damageMultiplier: 1,
          damageType: 'physical',
          weaponRange: 3,
          minRange: 1,
        },
      },
    });

    const preview = getEnemyCombatPreview(createDungeonState(boss), boss);

    expect(preview.isFasterThanPlayer).toBe(true);
    expect(preview.threatRating).toBe('Deadly');
  });
});
