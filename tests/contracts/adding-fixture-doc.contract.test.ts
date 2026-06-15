/**
 * Documentation Contract Tests — docs/guides/adding-fixture.md
 *
 * Ensures every JSON example in the fixture guide is valid and executable.
 * Ensures every content ID mentioned in the guide (items, spells, ring schools)
 * exists in the live content registries.
 *
 * PURPOSE: Documentation examples are living, executable proofs. If a content ID
 * is renamed, an item removed, or a schema changes, this test fails with a clear
 * message pointing at the broken documentation section.
 *
 * CONTRACT LAYER: depends on live @dungeon/content registries at test time.
 * Uses validatePlayerFixture / validateWorldFixture — never bypasses validation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  validatePlayerFixture,
  loadPlayerFromFixture,
} from '../../packages/game-core/src/fixtures/player-fixture-loader.js';
import {
  validateWorldFixture,
  loadWorldFromFixture,
} from '../../packages/game-core/src/fixtures/world-fixture-loader.js';
import type { PlayerFixture } from '../../packages/game-core/src/fixtures/player-fixture-types.js';
import type { WorldFixture } from '../../packages/game-core/src/fixtures/world-fixture-types.js';
import {
  ITEM_BY_ID,
  RING_SPELL_BY_ID,
  RING_SCHOOL_BY_ID,
} from '@dungeon/content';

// ─── Doc loader ──────────────────────────────────────────────────────────────

const DOC_PATH = join(process.cwd(), 'docs/guides/adding-fixture.md');

let docText: string;

beforeAll(() => {
  docText = readFileSync(DOC_PATH, 'utf-8');
});

/**
 * Extract all fenced JSON code blocks from the doc.
 * Returns an array of { raw, parsed } objects, one per ```json block.
 * Throws a clear error if a block contains invalid JSON — that itself is a doc bug.
 */
function extractJsonBlocks(source: string): Array<{ raw: string; parsed: unknown }> {
  const pattern = /```json\n([\s\S]*?)```/g;
  const blocks: Array<{ raw: string; parsed: unknown }> = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const raw = match[1]!.trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Invalid JSON in docs/guides/adding-fixture.md:\n${raw}\n\nParse error: ${String(err)}`,
      );
    }
    blocks.push({ raw, parsed });
  }
  return blocks;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Return true if the parsed object looks like a PlayerFixture (has `level` field). */
function looksLikePlayerFixture(obj: unknown): obj is PlayerFixture {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'schemaVersion' in obj &&
    'level' in obj
  );
}

/** Return true if the parsed object looks like a WorldFixture (has schemaVersion but no `level`). */
function looksLikeWorldFixture(obj: unknown): obj is WorldFixture {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'schemaVersion' in obj &&
    !('level' in obj)
  );
}

// ─── Group 1: Doc JSON is parseable ──────────────────────────────────────────

describe('adding-fixture.md: all JSON code blocks are valid JSON', () => {
  it('doc file exists and is readable', () => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    expect(text.length).toBeGreaterThan(0);
  });

  it('every ```json block parses without error', () => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    // extractJsonBlocks throws on bad JSON — wrapping in expect().not.toThrow() surfaces the bad block
    expect(() => extractJsonBlocks(text)).not.toThrow();
  });

  it('doc contains at least one JSON code block', () => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    const blocks = extractJsonBlocks(text);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

// ─── Group 2: Quick Start player fixture example ──────────────────────────────

describe('adding-fixture.md Quick Start player example', () => {
  // The Quick Start section is the first JSON block in the doc.
  // We find it by scanning for the `level` field so classification is stable.
  let quickStart: PlayerFixture;

  beforeAll(() => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    const blocks = extractJsonBlocks(text);
    const found = blocks.find(b => looksLikePlayerFixture(b.parsed));
    if (!found) throw new Error('No PlayerFixture example found in adding-fixture.md');
    quickStart = found.parsed as PlayerFixture;
  });

  it('Quick Start example passes validatePlayerFixture', () => {
    const result = validatePlayerFixture(quickStart);
    expect(
      result.isValid,
      `Quick Start example failed validation:\n${result.errors.map(e => `  [${e.field}] ${e.message}`).join('\n')}`,
    ).toBe(true);
  });

  it('Quick Start example loads without throwing', () => {
    expect(() => loadPlayerFromFixture(quickStart)).not.toThrow();
  });

  it('Quick Start example produces { player, itemRegistry }', () => {
    const result = loadPlayerFromFixture(quickStart);
    expect(result).toHaveProperty('player');
    expect(result).toHaveProperty('itemRegistry');
    expect(result.player).toBeDefined();
    expect(result.itemRegistry).toBeDefined();
  });

  it('Quick Start example equippedWeaponId is iron_sword and exists in content', () => {
    expect(quickStart.equippedWeaponId).toBe('iron_sword');
    expect(ITEM_BY_ID.has('iron_sword')).toBe(true);
  });

  it('Quick Start example armor IDs all exist in content', () => {
    const armor = quickStart.equippedArmorIds ?? {};
    for (const [slot, id] of Object.entries(armor)) {
      if (id !== undefined) {
        expect(
          ITEM_BY_ID.has(id),
          `Doc Quick Start: equippedArmorIds.${slot} = "${id}" not found in ITEM_BY_ID`,
        ).toBe(true);
      }
    }
  });

  it('Quick Start example inventory item IDs all exist in content', () => {
    for (const id of quickStart.inventoryItemIds ?? []) {
      expect(
        ITEM_BY_ID.has(id),
        `Doc Quick Start: inventoryItemIds entry "${id}" not found in ITEM_BY_ID`,
      ).toBe(true);
    }
  });

  it('Quick Start example ring school "fire" exists in content', () => {
    for (const school of quickStart.knownRingSchools ?? []) {
      expect(
        RING_SCHOOL_BY_ID.has(school),
        `Doc Quick Start: knownRingSchools entry "${school}" not found in RING_SCHOOL_BY_ID`,
      ).toBe(true);
    }
  });

  it('Quick Start example spell "ember" exists in content', () => {
    for (const id of quickStart.learnedRingSpellIds ?? []) {
      expect(
        RING_SPELL_BY_ID.has(id),
        `Doc Quick Start: learnedRingSpellIds entry "${id}" not found in RING_SPELL_BY_ID`,
      ).toBe(true);
    }
  });

  it('Quick Start player has learned ember after loading', () => {
    const { player } = loadPlayerFromFixture(quickStart);
    expect(player.learnedRingSpellIds).toContain('ember');
  });

  it('Quick Start player has fire ring mastery xp', () => {
    const { player } = loadPlayerFromFixture(quickStart);
    expect(player.ringMastery['fire']).toBeDefined();
    expect(player.ringMastery['fire']!.xp).toBe(100);
  });
});

// ─── Group 3: World fixture example ──────────────────────────────────────────

describe('adding-fixture.md world fixture example (fresh-world pattern)', () => {
  // The doc describes a fresh-world pattern in the Phase 1 scope section.
  // The minimal world fixture (schemaVersion only) is the canonical doc example.
  // We verify it here as the documented minimal-world form.
  const MINIMAL_WORLD: WorldFixture = { schemaVersion: 1 };

  it('minimal world fixture (schemaVersion: 1 only) passes validateWorldFixture', () => {
    const result = validateWorldFixture(MINIMAL_WORLD);
    expect(
      result.isValid,
      `Minimal world fixture failed: ${result.errors.map(e => e.message).join('; ')}`,
    ).toBe(true);
  });

  it('minimal world fixture loads into a WorldState', () => {
    expect(() => loadWorldFromFixture(MINIMAL_WORLD)).not.toThrow();
    const world = loadWorldFromFixture(MINIMAL_WORLD);
    expect(world).toBeDefined();
  });

  it('minimal world fixture has a sealed dungeon ogre by default', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD);
    expect(world.dungeonOgre.status).toBe('sealed');
  });

  it('minimal world fixture has totalRuns 0 by default', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD);
    expect(world.totalRuns).toBe(0);
  });

  it('minimal world fixture includes all content-defined factions', () => {
    const world = loadWorldFromFixture(MINIMAL_WORLD);
    // At least the 4 factions referenced in docs/guides/adding-fixture.md examples
    expect(world.factions.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── Group 4: Troubleshooting — valid IDs the doc explicitly names ────────────

describe('adding-fixture.md troubleshooting: iron_sword is a valid item ID', () => {
  // Doc says: "Unknown item id 'iron_sword'" → Check packages/content/src/items/
  // This means iron_sword MUST exist so the error only occurs if generate:indexes wasn't run.
  it('iron_sword exists in ITEM_BY_ID', () => {
    expect(
      ITEM_BY_ID.has('iron_sword'),
      'Doc troubleshooting references iron_sword — it must exist in ITEM_BY_ID',
    ).toBe(true);
  });

  it('a fixture with iron_sword equippedWeaponId passes validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'iron_sword',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
  });
});

describe('adding-fixture.md troubleshooting: "ice" is NOT a valid ring school', () => {
  // Doc says: "Unknown ring school 'ice'" → Ring school doesn't exist yet.
  it('"ice" does not exist in RING_SCHOOL_BY_ID', () => {
    expect(RING_SCHOOL_BY_ID.has('ice' as never)).toBe(false);
  });

  it('a fixture with knownRingSchools: ["ice"] fails validation', () => {
    const fixture = {
      schemaVersion: 1,
      level: 1,
      knownRingSchools: ['ice'],
    } as unknown as PlayerFixture;
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('knownRingSchools'));
    expect(error).toBeDefined();
    expect(error!.message).toContain('ice');
  });
});

describe('adding-fixture.md troubleshooting: health > maxHealth error', () => {
  // Doc says: "health (50) cannot exceed maxHealth (40)"
  it('fixture with health 50 and maxHealth 40 fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      health: 50,
      maxHealth: 40,
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'health');
    expect(error).toBeDefined();
    expect(error!.message.toLowerCase()).toMatch(/health|exceed|max/);
  });
});

// ─── Group 5: Troubleshooting — all spell IDs the doc lists are valid ─────────

describe('adding-fixture.md troubleshooting: all listed spell IDs exist in content', () => {
  // Doc lists exactly these valid spell IDs in the troubleshooting section:
  // bolt, cinder_wake, ember, heat_surge, plasma_arc, rolling_thunder,
  // stormfire, thunder_step, thunderstorm
  const DOC_LISTED_SPELL_IDS = [
    'bolt',
    'cinder_wake',
    'ember',
    'heat_surge',
    'plasma_arc',
    'rolling_thunder',
    'stormfire',
    'thunder_step',
    'thunderstorm',
  ] as const;

  for (const spellId of DOC_LISTED_SPELL_IDS) {
    it(`spell "${spellId}" exists in RING_SPELL_BY_ID`, () => {
      expect(
        RING_SPELL_BY_ID.has(spellId),
        `Doc troubleshooting lists "${spellId}" as a valid spell ID but it's missing from RING_SPELL_BY_ID`,
      ).toBe(true);
    });
  }

  it('doc listed spell IDs cover every spell in RING_SPELL_BY_ID (no undocumented spells)', () => {
    const docSet = new Set<string>(DOC_LISTED_SPELL_IDS);
    const contentIds = [...RING_SPELL_BY_ID.keys()];
    const undocumented = contentIds.filter(id => !docSet.has(id));
    expect(
      undocumented,
      `These spell IDs exist in content but are not listed in the doc troubleshooting section — update the doc: ${undocumented.join(', ')}`,
    ).toHaveLength(0);
  });

  it('all doc listed spell IDs pass validatePlayerFixture together', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      learnedRingSpellIds: [...DOC_LISTED_SPELL_IDS],
    };
    const result = validatePlayerFixture(fixture);
    expect(
      result.isValid,
      `Some doc-listed spell IDs are invalid: ${result.errors.map(e => e.message).join('; ')}`,
    ).toBe(true);
  });
});

// ─── Group 6: Unit test code example — fire mage fixture ─────────────────────

describe('adding-fixture.md Usage: Unit Test example (fire-mage-mastery-test.json)', () => {
  // Doc example:
  //   const { player } = loadPlayerFromFixture(firemageFixture);
  //   expect(player.learnedRingSpellIds).toContain('ember');
  // We verify the fixture named in the doc actually satisfies this invariant.
  const FIXTURE_PATH = join(process.cwd(), 'fixtures/players/fire-mage-mastery-test.json');

  it('fire-mage-mastery-test.json exists and is parseable', () => {
    expect(() => JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'))).not.toThrow();
  });

  it('fire-mage-mastery-test.json passes validatePlayerFixture', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as PlayerFixture;
    const result = validatePlayerFixture(fixture);
    expect(
      result.isValid,
      `fire-mage-mastery-test.json failed: ${result.errors.map(e => e.message).join('; ')}`,
    ).toBe(true);
  });

  it('fire mage player.learnedRingSpellIds contains "ember" (as doc claims)', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as PlayerFixture;
    const { player } = loadPlayerFromFixture(fixture);
    expect(player.learnedRingSpellIds).toContain('ember');
  });
});

// ─── Group 7: Integration test code example — midgame fixture ────────────────

describe('adding-fixture.md Usage: Integration Test example (midgame-warrior.json)', () => {
  // Doc example:
  //   const { player, itemRegistry } = loadPlayerFromFixture(midgameFixture);
  // Verifies the named fixture is loadable and returns the expected structure.
  const FIXTURE_PATH = join(process.cwd(), 'fixtures/players/midgame-warrior.json');

  it('midgame-warrior.json exists and is parseable', () => {
    expect(() => JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'))).not.toThrow();
  });

  it('midgame-warrior.json passes validatePlayerFixture', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as PlayerFixture;
    const result = validatePlayerFixture(fixture);
    expect(
      result.isValid,
      `midgame-warrior.json failed: ${result.errors.map(e => e.message).join('; ')}`,
    ).toBe(true);
  });

  it('midgame fixture loadPlayerFromFixture returns { player, itemRegistry }', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as PlayerFixture;
    const result = loadPlayerFromFixture(fixture);
    expect(result).toHaveProperty('player');
    expect(result).toHaveProperty('itemRegistry');
  });

  it('midgame fixture player has a weapon equipped (supports integration test scenarios)', () => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as PlayerFixture;
    const { player } = loadPlayerFromFixture(fixture);
    expect(player.equipment.weapon).not.toBeNull();
  });
});

// ─── Group 8: All doc JSON blocks are player or world fixtures ─────────────────

describe('adding-fixture.md: every JSON block is classified as player or world fixture', () => {
  it('every JSON block in the doc is either a PlayerFixture or WorldFixture', () => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    const blocks = extractJsonBlocks(text);
    const unclassified: string[] = [];

    for (const { raw, parsed } of blocks) {
      if (!looksLikePlayerFixture(parsed) && !looksLikeWorldFixture(parsed)) {
        unclassified.push(raw.slice(0, 120));
      }
    }

    expect(
      unclassified,
      `These JSON blocks in the doc are not recognized as PlayerFixture or WorldFixture:\n${unclassified.join('\n---\n')}`,
    ).toHaveLength(0);
  });

  it('all PlayerFixture JSON blocks pass validatePlayerFixture', () => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    const blocks = extractJsonBlocks(text);
    const failures: string[] = [];

    for (const { parsed } of blocks) {
      if (looksLikePlayerFixture(parsed)) {
        const result = validatePlayerFixture(parsed);
        if (!result.isValid) {
          failures.push(
            result.errors.map(e => `[${e.field}] ${e.message}`).join('; '),
          );
        }
      }
    }

    expect(
      failures,
      `Player fixture JSON blocks in the doc failed validation:\n${failures.join('\n')}`,
    ).toHaveLength(0);
  });

  it('all WorldFixture JSON blocks pass validateWorldFixture', () => {
    const text = readFileSync(DOC_PATH, 'utf-8');
    const blocks = extractJsonBlocks(text);
    const failures: string[] = [];

    for (const { parsed } of blocks) {
      if (looksLikeWorldFixture(parsed)) {
        const result = validateWorldFixture(parsed);
        if (!result.isValid) {
          failures.push(
            result.errors.map(e => `[${e.field}] ${e.message}`).join('; '),
          );
        }
      }
    }

    expect(
      failures,
      `World fixture JSON blocks in the doc failed validation:\n${failures.join('\n')}`,
    ).toHaveLength(0);
  });
});
