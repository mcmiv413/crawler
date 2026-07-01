/**
 * Player Fixture Loader — Phase 1
 *
 * Validates and loads PlayerFixture data into Player instances.
 * Uses existing domain creation pathways; does not bypass validation.
 * No randomness — fixture loading is fully deterministic.
 */

import type { Player, Equipment, EntityId, AnyItemTemplate } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import {
  ITEM_BY_ID,
  MAGIC,
  RING_SCHOOL_BY_ID,
  RING_SPELL_BY_ID,
} from '@dungeon/content';
import { getBasePlayerStatsForLevel } from '../systems/progression.js';
import type { PlayerFixture, FixtureValidationError, FixtureValidationResult, FixtureLoadResult } from './player-fixture-types.js';

/** Current supported fixture schema version. */
export const FIXTURE_SCHEMA_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a PlayerFixture for structural and content-reference correctness.
 * Returns a result with isValid flag and a list of errors, each identifying
 * the offending field and describing the problem.
 *
 * Never silently succeeds — every invalid fixture produces at least one error.
 */
export function validatePlayerFixture(fixture: PlayerFixture): FixtureValidationResult {
  const effectiveMaxHealth = fixture.maxHealth ?? getBasePlayerStatsForLevel(fixture.level).maxHealth;
  const effectiveMaxMana = fixture.maxMana ?? MAGIC.initialMana;

  const errors: FixtureValidationError[] = [
    // schemaVersion
    ...(fixture.schemaVersion !== FIXTURE_SCHEMA_VERSION
      ? [{
          field: 'schemaVersion',
          message: `Unsupported fixture schemaVersion ${fixture.schemaVersion}. Expected ${FIXTURE_SCHEMA_VERSION}.`,
        }]
      : []),

    // level
    ...(typeof fixture.level !== 'number' || fixture.level < 1 || !Number.isInteger(fixture.level)
      ? [{
          field: 'level',
          message: `level must be an integer ≥ 1, got ${fixture.level}.`,
        }]
      : []),

    // experience
    ...(fixture.experience !== undefined && (typeof fixture.experience !== 'number' || fixture.experience < 0 || !Number.isFinite(fixture.experience))
      ? [{
          field: 'experience',
          message: `experience must be a non-negative number, got ${fixture.experience}.`,
        }]
      : []),

    // gold
    ...(fixture.gold !== undefined && (typeof fixture.gold !== 'number' || fixture.gold < 0 || !Number.isFinite(fixture.gold))
      ? [{
          field: 'gold',
          message: `gold must be a non-negative number, got ${fixture.gold}.`,
        }]
      : []),

    // maxHealth
    ...(fixture.maxHealth !== undefined && (typeof fixture.maxHealth !== 'number' || fixture.maxHealth <= 0 || !Number.isFinite(fixture.maxHealth))
      ? [{
          field: 'maxHealth',
          message: `maxHealth must be a positive finite number, got ${fixture.maxHealth}.`,
        }]
      : []),

    // health
    ...(fixture.health !== undefined
      ? (typeof fixture.health !== 'number' || fixture.health < 0 || !Number.isFinite(fixture.health)
          ? [{
              field: 'health',
              message: `health must be a non-negative finite number, got ${fixture.health}.`,
            }]
          : fixture.health > effectiveMaxHealth
            ? [{
                field: 'health',
                message: `health (${fixture.health}) cannot exceed maxHealth (${effectiveMaxHealth}).`,
              }]
            : [])
      : []),

    // maxMana
    ...(fixture.maxMana !== undefined && (typeof fixture.maxMana !== 'number' || fixture.maxMana < 0 || !Number.isFinite(fixture.maxMana))
      ? [{
          field: 'maxMana',
          message: `maxMana must be a non-negative finite number, got ${fixture.maxMana}.`,
        }]
      : []),

    // mana
    ...(fixture.mana !== undefined
      ? (typeof fixture.mana !== 'number' || fixture.mana < 0 || !Number.isFinite(fixture.mana)
          ? [{
              field: 'mana',
              message: `mana must be a non-negative finite number, got ${fixture.mana}.`,
            }]
          : fixture.mana > effectiveMaxMana
            ? [{
                field: 'mana',
                message: `mana (${fixture.mana}) cannot exceed maxMana (${effectiveMaxMana}).`,
              }]
            : [])
      : []),

    // equippedWeaponId — type is string | undefined; null is explicitly invalid
    ...((): FixtureValidationError[] => {
      if ((fixture.equippedWeaponId as unknown) === null) {
        return [{
          field: 'equippedWeaponId',
          message: `equippedWeaponId must be a string or omitted (undefined), but got null. Use undefined to leave the weapon slot empty.`,
        }];
      }
      if (fixture.equippedWeaponId === undefined) return [];
      if (!ITEM_BY_ID.has(fixture.equippedWeaponId)) {
        return [{
          field: 'equippedWeaponId',
          message: `Unknown item id \"${fixture.equippedWeaponId}\" in equippedWeaponId. Must exist in ITEM_BY_ID.`,
        }];
      }
      const template = ITEM_BY_ID.get(fixture.equippedWeaponId);
      return template !== undefined && template.itemClass !== 'weapon'
        ? [{
            field: 'equippedWeaponId',
            message: `Item \"${fixture.equippedWeaponId}\" (itemClass=\"${template.itemClass}\") is not a weapon and cannot be placed in the weapon slot.`,
          }]
        : [];
    })(),

    // equippedArmorIds
    ...(fixture.equippedArmorIds !== undefined
      ? Object.entries(fixture.equippedArmorIds).flatMap(([slot, itemId]) => {
          if (itemId === undefined) return [];
          if (!ITEM_BY_ID.has(itemId)) {
            return [{
              field: `equippedArmorIds.${slot}`,
              message: `Unknown item id \"${itemId}\" in equippedArmorIds.${slot}. Must exist in ITEM_BY_ID.`,
            }];
          }
          const template = ITEM_BY_ID.get(itemId);
          if (template !== undefined) {
            const isSecondaryWeapon = slot === 'secondaryWeapon';
            const allowedClass = (isSecondaryWeapon === true) ? 'weapon' : 'armor';
            if (template.itemClass !== allowedClass) {
              return [{
                field: `equippedArmorIds.${slot}`,
                message: `Item \"${itemId}\" (itemClass=\"${template.itemClass}\") is not ${(isSecondaryWeapon === true) ? 'a weapon' : 'an armor item'} and cannot be placed in the ${slot} slot.`,
              }];
            }
          }
          return [];
        })
      : []),

    // activeEquipmentIds (ring slots)
    ...(fixture.activeEquipmentIds !== undefined
      ? Object.entries(fixture.activeEquipmentIds).flatMap(([slot, itemId]) => {
          if (itemId === undefined) return [];
          if (!ITEM_BY_ID.has(itemId)) {
            return [{
              field: `activeEquipmentIds.${slot}`,
              message: `Unknown item id \"${itemId}\" in activeEquipmentIds.${slot}. Must exist in ITEM_BY_ID.`,
            }];
          }
          const template = ITEM_BY_ID.get(itemId);
          if (template !== undefined) {
            if (template.itemClass !== 'armor') {
              return [{
                field: `activeEquipmentIds.${slot}`,
                message: `Item \"${itemId}\" (itemClass=\"${template.itemClass}\") is not an armor/ring item and cannot be placed in the ${slot} slot.`,
              }];
            }
            // Verify it's actually a ring (armorSlot === 'ring')
            const armorTemplate = template as { itemClass: 'armor'; armor: { slot: string } };
            if ('armor' in armorTemplate && armorTemplate.armor.slot !== 'ring') {
              return [{
                field: `activeEquipmentIds.${slot}`,
                message: `Item \"${itemId}\" (armorSlot=\"${armorTemplate.armor.slot}\") is not a ring and cannot be placed in the ${slot} slot.`,
              }];
            }
          }
          return [];
        })
      : []),

    // inventoryItemIds
    ...(fixture.inventoryItemIds ?? []).flatMap((itemId, i) =>
      !ITEM_BY_ID.has(itemId)
        ? [{
            field: `inventoryItemIds[${i}]`,
            message: `Unknown item id \"${itemId}\" at inventoryItemIds[${i}]. Must exist in ITEM_BY_ID.`,
          }]
        : []
    ),

    // knownRingSchools
    ...(fixture.knownRingSchools ?? []).flatMap(school =>
      !RING_SCHOOL_BY_ID.has(school)
        ? [{
            field: 'knownRingSchools',
            message: `Unknown ring school \"${school}\" in knownRingSchools. Valid schools: ${[...RING_SCHOOL_BY_ID.keys()].join(', ')}.`,
          }]
        : []
    ),

    // ringMastery: widen to unknown so all defensive null/type checks are genuinely
    // necessary to TypeScript — fixture data may be malformed JSON at runtime.
    ...((): FixtureValidationError[] => {
      const ringMasteryRaw: unknown = fixture.ringMastery;
      if (ringMasteryRaw === null) {
        return [{
          field: 'ringMastery',
          message: `ringMastery must not be null; use undefined to omit it.`,
        }];
      }
      if (ringMasteryRaw === undefined) return [];
      if (typeof ringMasteryRaw !== 'object' || Array.isArray(ringMasteryRaw)) {
        return [{
          field: 'ringMastery',
          message: `ringMastery must be an object or undefined, got ${typeof ringMasteryRaw}.`,
        }];
      }
      return Object.entries(ringMasteryRaw as Record<string, unknown>).flatMap(([school, mastery]) => {
        const schoolErrors: FixtureValidationError[] = !RING_SCHOOL_BY_ID.has(school)
          ? [{
              field: `ringMastery.${school}`,
              message: `Unknown ring school \"${school}\" in ringMastery. Valid schools: ${[...RING_SCHOOL_BY_ID.keys()].join(', ')}.`,
            }]
          : [];
        const masteryRecord = mastery !== null && typeof mastery === 'object' && !Array.isArray(mastery)
          ? (mastery as Record<string, unknown>)
          : null;
        const xp: unknown = masteryRecord !== null ? masteryRecord['xp'] : undefined;
        const xpIsInvalid = masteryRecord === null
          || typeof xp !== 'number'
          || !Number.isFinite(xp)
          || xp < 0;
        if (xpIsInvalid === true) {
          return [
            ...schoolErrors,
            {
              field: `ringMastery.${school}`,
              message: `ringMastery.${school} must be { xp: <non-negative number> }, got ${mastery === null ? 'null' : typeof mastery}.`,
            },
          ];
        }
        // masteryRecord is guaranteed non-null here (xpIsInvalid is false implies masteryRecord !== null)
        const levelValue: unknown = masteryRecord['level'];
        if (levelValue !== undefined) {
          const levelIsInvalid = typeof levelValue !== 'number'
            || !Number.isFinite(levelValue)
            || !Number.isInteger(levelValue)
            || levelValue < 1;
          if (levelIsInvalid === true) {
            return [
              ...schoolErrors,
              {
                field: `ringMastery.${school}`,
                message: `ringMastery.${school}.level must be a positive integer when present, got ${JSON.stringify(levelValue)}.`,
              },
            ];
          }
        }
        return schoolErrors;
      });
    })(),

    // learnedRingSpellIds
    ...(fixture.learnedRingSpellIds ?? []).flatMap((spellId, i) =>
      !RING_SPELL_BY_ID.has(spellId)
        ? [{
            field: `learnedRingSpellIds[${i}]`,
            message: `Unknown ring spell id \"${spellId}\" at learnedRingSpellIds[${i}]. Must exist in RING_SPELL_BY_ID.`,
          }]
        : []
    ),

    // Duplicate equipment detection: collect all specified item IDs across equipment slots
    ...((): FixtureValidationError[] => {
      const equippedItemIds: string[] = [
        ...(fixture.equippedWeaponId !== undefined ? [fixture.equippedWeaponId] : []),
        ...(fixture.equippedArmorIds !== undefined
          ? Object.values(fixture.equippedArmorIds).filter((id): id is string => id !== undefined)
          : []),
        ...(fixture.activeEquipmentIds !== undefined
          ? Object.values(fixture.activeEquipmentIds).filter((id): id is string => id !== undefined)
          : []),
      ];
      const seen = new Set<string>();
      for (const itemId of equippedItemIds) {
        if (seen.has(itemId)) {
          return [{
            field: 'equipment',
            message: `Duplicate equipment item id \"${itemId}\" appears in multiple equipment slots.`,
          }];
        }
        seen.add(itemId);
      }
      return [];
    })(),
  ];

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a PlayerFixture into a FixtureLoadResult containing a valid Player
 * and a pre-populated ItemRegistry.
 *
 * Validates the fixture first. Throws a FixtureLoadError if validation fails.
 * Loading is fully deterministic — no randomness is used.
 *
 * The resulting Player is indistinguishable from a player who reached the same
 * state through normal gameplay. The returned itemRegistry must be merged into
 * the GameState so that runtime systems can resolve item lookups.
 */
export function loadPlayerFromFixture(fixture: PlayerFixture): FixtureLoadResult {
  const validation = validatePlayerFixture(fixture);
  if (validation.isValid === false) {
    const messages = validation.errors.map(e => `  [${e.field}] ${e.message}`).join('\n');
    throw new FixtureLoadError(
      `Invalid player fixture — ${validation.errors.length} error(s):\n${messages}`,
      validation.errors,
    );
  }

  return buildPlayerResult(fixture);
}

/**
 * Error thrown when a fixture fails validation during loading.
 */
export class FixtureLoadError extends Error {
  readonly validationErrors: readonly FixtureValidationError[];

  constructor(message: string, validationErrors: readonly FixtureValidationError[]) {
    super(message);
    this.name = 'FixtureLoadError';
    this.validationErrors = validationErrors;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal construction helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a FixtureLoadResult (Player + ItemRegistry) from a validated fixture. */
function buildPlayerResult(fixture: PlayerFixture): FixtureLoadResult {
  const level = fixture.level;
  const levelStats = getBasePlayerStatsForLevel(level);
  const maxHealth = fixture.maxHealth ?? levelStats.maxHealth;
  const health = fixture.health ?? maxHealth;
  const maxMana = fixture.maxMana ?? MAGIC.initialMana;
  const mana = fixture.mana ?? maxMana;

  // Compute base stats incorporating level-up gains
  const baseStats = {
    ...levelStats,
    maxHealth,
    health,
  };

  // stats === baseStats for fixture-loaded players (no equipment bonuses yet;
  // equipment bonuses are applied by the equipment system at runtime)
  const stats = { ...baseStats };

  // Build item registry and equipment, inventory entity IDs
  // We assign deterministic entity IDs using a counter
  let idCounter = 1;
  function nextId(prefix: string): EntityId {
    return entityId(`fixture_${prefix}_${idCounter++}`);
  }

  // Helper: assign an EntityId and return both the id and the registry entry (if item exists)
  function assignEntry(contentItemId: string, prefix: string): { eid: EntityId; entry: [EntityId, AnyItemTemplate] | undefined } {
    const eid = nextId(prefix);
    const template = ITEM_BY_ID.get(contentItemId);
    return { eid, entry: template !== undefined ? [eid, template] : undefined };
  }

  // Build equipment slots — each returns { eid, entry? }
  const weaponResult = fixture.equippedWeaponId !== undefined
    ? assignEntry(fixture.equippedWeaponId, 'weapon') : null;

  const chestResult = fixture.equippedArmorIds?.chest !== undefined
    ? assignEntry(fixture.equippedArmorIds.chest, 'chest') : null;

  const headResult = fixture.equippedArmorIds?.head !== undefined
    ? assignEntry(fixture.equippedArmorIds.head, 'head') : null;

  const glovesResult = fixture.equippedArmorIds?.gloves !== undefined
    ? assignEntry(fixture.equippedArmorIds.gloves, 'gloves') : null;

  const bootsResult = fixture.equippedArmorIds?.boots !== undefined
    ? assignEntry(fixture.equippedArmorIds.boots, 'boots') : null;

  const secondaryWeaponResult = fixture.equippedArmorIds?.secondaryWeapon !== undefined
    ? assignEntry(fixture.equippedArmorIds.secondaryWeapon, 'secondary') : null;

  const ring1Result = fixture.activeEquipmentIds?.ring1 !== undefined
    ? assignEntry(fixture.activeEquipmentIds.ring1, 'ring1') : null;

  const ring2Result = fixture.activeEquipmentIds?.ring2 !== undefined
    ? assignEntry(fixture.activeEquipmentIds.ring2, 'ring2') : null;

  const equipment: Equipment = {
    weapon: weaponResult?.eid ?? null,
    secondaryWeapon: secondaryWeaponResult?.eid ?? null,
    chest: chestResult?.eid ?? null,
    head: headResult?.eid ?? null,
    gloves: glovesResult?.eid ?? null,
    boots: bootsResult?.eid ?? null,
    ring1: ring1Result?.eid ?? null,
    ring2: ring2Result?.eid ?? null,
  };

  // Build inventory — map returns { eid, entry? } per item, then split into ids and registry entries
  const inventoryResults = (fixture.inventoryItemIds ?? []).map((contentItemId, idx) => {
    const eid = entityId(`fixture_inv_${idx + 1}`);
    const template = ITEM_BY_ID.get(contentItemId);
    return { eid, entry: template !== undefined ? [eid, template] as [EntityId, AnyItemTemplate] : undefined };
  });

  const inventory: EntityId[] = inventoryResults.map(r => r.eid);

  // Collect all registry entries functionally from equipment slots and inventory
  const registryEntries: Array<[EntityId, AnyItemTemplate]> = [
    ...[weaponResult, chestResult, headResult, glovesResult, bootsResult, secondaryWeaponResult, ring1Result, ring2Result]
      .flatMap(r => r?.entry != null ? [r.entry] : []),
    ...inventoryResults.flatMap(r => r.entry != null ? [r.entry] : []),
  ];

  // Build ring mastery
  const ringMastery: Record<string, { readonly xp: number }> = {};
  if (fixture.ringMastery !== undefined) {
    for (const [school, mastery] of Object.entries(fixture.ringMastery)) {
      ringMastery[school] = { xp: mastery.xp };
    }
  }

  // Build learned ring spells
  const learnedRingSpellIds: readonly string[] = fixture.learnedRingSpellIds ?? [];

  // Build known ring schools
  const knownRingSchools: readonly string[] = fixture.knownRingSchools ?? [];

  const player: Player = {
    id: entityId('fixture_player'),
    name: 'Hero',
    level,
    experience: fixture.experience ?? 0,
    stats,
    baseStats,
    position: { x: 0, y: 0 },
    equipment,
    inventory,
    statuses: [],
    abilities: [],
    gold: fixture.gold ?? 0,
    floor: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalRuns: 0,
    deathStash: null,
    mana,
    maxMana,
    ringMastery,
    learnedRingSpellIds,
    knownRingSchools,
  };

  const itemRegistry = { items: new Map(registryEntries) };

  return { player, itemRegistry };
}
