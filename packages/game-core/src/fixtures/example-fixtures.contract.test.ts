/**
 * Contract tests for the example player fixtures.
 *
 * Verifies that each fixture file under fixtures/players/ is valid and
 * produces a loadable player. These tests serve as living documentation:
 * if a fixture breaks, the error message identifies exactly what changed.
 *
 * Per the plan: "At least four example fixtures exist and are exercised by
 * automated tests."
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePlayerFixture, loadPlayerFromFixture } from './player-fixture-loader.js';
import type { PlayerFixture } from './player-fixture-types.js';

// process.cwd() is the repo root when tests are run from the workspace root
const FIXTURES_DIR = join(process.cwd(), 'fixtures/players');

function loadFixtureFile(name: string): PlayerFixture {
  const filePath = join(FIXTURES_DIR, `${name}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as PlayerFixture;
}

// ─── new-character ───────────────────────────────────────────────────────────

describe('example fixture: new-character', () => {
  const fixture = loadFixtureFile('new-character');

  it('passes validation', () => {
    const result = validatePlayerFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a player at level 1', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.level).toBe(1);
  });

  it('has zero gold', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.gold).toBe(0);
  });

  it('has empty inventory', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.inventory).toHaveLength(0);
  });

  it('has no equipment', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.equipment.weapon).toBeNull();
    expect(player.equipment.chest).toBeNull();
  });

  it('has no ring mastery', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(Object.keys(player.ringMastery)).toHaveLength(0);
  });
});

// ─── midgame-warrior ─────────────────────────────────────────────────────────

describe('example fixture: midgame-warrior', () => {
  const fixture = loadFixtureFile('midgame-warrior');

  it('passes validation', () => {
    const result = validatePlayerFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a player at level 5', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.level).toBe(5);
  });

  it('has gold', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.gold).toBeGreaterThan(0);
  });

  it('has a weapon equipped', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.equipment.weapon).not.toBeNull();
  });

  it('has chest armor equipped', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.equipment.chest).not.toBeNull();
  });

  it('has inventory items', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.inventory.length).toBeGreaterThan(0);
  });

  it('has no ring mastery (pure melee warrior)', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(Object.keys(player.ringMastery)).toHaveLength(0);
  });
});

// ─── fire-mage-mastery-test ───────────────────────────────────────────────────

describe('example fixture: fire-mage-mastery-test', () => {
  const fixture = loadFixtureFile('fire-mage-mastery-test');

  it('passes validation', () => {
    const result = validatePlayerFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a player at level 7', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.level).toBe(7);
  });

  it('has fire ring mastery xp', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.ringMastery['fire']).toBeDefined();
    expect(player.ringMastery['fire']!.xp).toBeGreaterThan(0);
  });

  it('has learned ring spells', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.learnedRingSpellIds.length).toBeGreaterThan(0);
  });

  it('has fire ring equipped', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.equipment.ring1).not.toBeNull();
  });

  it('has elevated mana cap', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.maxMana).toBeGreaterThan(20);
  });
});

// ─── high-level-everything ────────────────────────────────────────────────────

describe('example fixture: high-level-everything', () => {
  const fixture = loadFixtureFile('high-level-everything');

  it('passes validation', () => {
    const result = validatePlayerFixture(fixture);
    expect(result.isValid, `Validation errors: ${result.errors.map(e => e.message).join('; ')}`).toBe(true);
  });

  it('loads into a player at level 10', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.level).toBe(10);
  });

  it('has mastery in both ring schools', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.ringMastery['fire']).toBeDefined();
    expect(player.ringMastery['lightning']).toBeDefined();
  });

  it('has both ring slots filled', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.equipment.ring1).not.toBeNull();
    expect(player.equipment.ring2).not.toBeNull();
  });

  it('has learned 6 ring spells', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.learnedRingSpellIds).toHaveLength(6);
  });

  it('has a full equipment set', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.equipment.weapon).not.toBeNull();
    expect(player.equipment.chest).not.toBeNull();
    expect(player.equipment.head).not.toBeNull();
    expect(player.equipment.gloves).not.toBeNull();
    expect(player.equipment.boots).not.toBeNull();
  });

  it('has maximum gold', () => {
    const player = loadPlayerFromFixture(fixture);
    expect(player.gold).toBe(999);
  });
});
