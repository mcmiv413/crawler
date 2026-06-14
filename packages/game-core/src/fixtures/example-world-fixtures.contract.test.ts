/**
 * Contract tests for the example world fixtures.
 *
 * Verifies that each fixture file under fixtures/worlds/ is valid and
 * produces a loadable WorldState. These tests serve as living documentation:
 * if a fixture breaks, the error message identifies exactly what changed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateWorldFixture, loadWorldFromFixture } from './world-fixture-loader.js';
import type { WorldFixture } from './world-fixture-types.js';

const WORLDS_DIR = join(process.cwd(), 'fixtures/worlds');

function loadWorldFixtureFile(name: string): WorldFixture {
  const filePath = join(WORLDS_DIR, `${name}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as WorldFixture;
}

// ─── fresh-world ─────────────────────────────────────────────────────────────

describe('example world fixture: fresh-world', () => {
  const fixture = loadWorldFixtureFile('fresh-world');

  it('passes validation', () => {
    const result = validateWorldFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a WorldState', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world).toBeDefined();
  });

  it('has all four factions', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.factions).toHaveLength(4);
  });

  it('has sealed dungeon ogre', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.dungeonOgre.status).toBe('sealed');
  });

  it('has zero total runs', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.totalRuns).toBe(0);
  });

  it('has zero deepest floor', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.deepestFloor).toBe(0);
  });

  it('has default prosperity of 50', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.town.prosperity).toBe(50);
  });

  it('has highestRarityFound of common', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.highestRarityFound).toBe('common');
  });
});

// ─── mid-corruption-world ────────────────────────────────────────────────────

describe('example world fixture: mid-corruption-world', () => {
  const fixture = loadWorldFixtureFile('mid-corruption-world');

  it('passes validation', () => {
    const result = validateWorldFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a WorldState', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world).toBeDefined();
  });

  it('has all four factions', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.factions).toHaveLength(4);
  });

  it('goblin warband has elevated power of 65', () => {
    const world = loadWorldFromFixture(fixture);
    const goblin = world.factions.find(f => f.id === 'goblin_warband');
    expect(goblin!.power).toBe(65);
  });

  it('has sealed dungeon ogre', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.dungeonOgre.status).toBe('sealed');
  });

  it('has 3 total runs', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.totalRuns).toBe(3);
  });

  it('has deepest floor of 6', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.deepestFloor).toBe(6);
  });

  it('has town prosperity of 40', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.town.prosperity).toBe(40);
  });

  it('has town fear of 35', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.town.fear).toBe(35);
  });

  it('has highestRarityFound of uncommon', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.highestRarityFound).toBe('uncommon');
  });
});

// ─── ogre-emergence-world ────────────────────────────────────────────────────

describe('example world fixture: ogre-emergence-world', () => {
  const fixture = loadWorldFixtureFile('ogre-emergence-world');

  it('passes validation', () => {
    const result = validateWorldFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a WorldState', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world).toBeDefined();
  });

  it('has all four factions', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.factions).toHaveLength(4);
  });

  it('goblin warband has power 85', () => {
    const world = loadWorldFromFixture(fixture);
    const goblin = world.factions.find(f => f.id === 'goblin_warband');
    expect(goblin!.power).toBe(85);
  });

  it('shadow cult has power 70', () => {
    const world = loadWorldFromFixture(fixture);
    const cult = world.factions.find(f => f.id === 'shadow_cult');
    expect(cult!.power).toBe(70);
  });

  it('dungeon ogre has emerged status', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.dungeonOgre.status).toBe('emerged');
  });

  it('dungeon ogre emerged after run 6', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.dungeonOgre.emergedAfterRun).toBe(6);
  });

  it('dungeon ogre emerged at depth 8', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.dungeonOgre.emergedAtDepth).toBe(8);
  });

  it('has 8 total runs', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.totalRuns).toBe(8);
  });

  it('has deepest floor of 12', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.deepestFloor).toBe(12);
  });

  it('has town fear of 70', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.town.fear).toBe(70);
  });

  it('has highestRarityFound of rare', () => {
    const world = loadWorldFromFixture(fixture);
    expect(world.highestRarityFound).toBe('rare');
  });
});
