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
  BASE_PLAYER_STATS,
  ITEM_BY_ID,
  MAGIC,
  RING_SCHOOL_BY_ID,
  RING_SPELL_BY_ID,
  LEVEL_UP_GAINS,
} from '@dungeon/content';
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
  let errors: FixtureValidationError[] = [];

  // schemaVersion
  if (fixture.schemaVersion !== FIXTURE_SCHEMA_VERSION) {
    errors = [...errors, {
      field: 'schemaVersion',
      message: `Unsupported fixture schemaVersion ${fixture.schemaVersion}. Expected ${FIXTURE_SCHEMA_VERSION}.`,
    }];
  }

  // level
  if (typeof fixture.level !== 'number' || fixture.level < 1 || !Number.isInteger(fixture.level)) {
    errors = [...errors, {
      field: 'level',
      message: `level must be an integer ≥ 1, got ${fixture.level}.`,
    }];
  }

  // experience
  if (fixture.experience !== undefined) {
    if (typeof fixture.experience !== 'number' || fixture.experience < 0 || !Number.isFinite(fixture.experience)) {
      errors = [...errors, {
        field: 'experience',
        message: `experience must be a non-negative number, got ${fixture.experience}.`,
      }];
    }
  }

  // gold
  if (fixture.gold !== undefined) {
    if (typeof fixture.gold !== 'number' || fixture.gold < 0 || !Number.isFinite(fixture.gold)) {
      errors = [...errors, {
        field: 'gold',
        message: `gold must be a non-negative number, got ${fixture.gold}.`,
      }];
    }
  }

  // health / maxHealth cross-validation
  const effectiveMaxHealth = fixture.maxHealth ?? computeMaxHealth(fixture.level);
  if (fixture.maxHealth !== undefined) {
    if (typeof fixture.maxHealth !== 'number' || fixture.maxHealth <= 0 || !Number.isFinite(fixture.maxHealth)) {
      errors = [...errors, {
        field: 'maxHealth',
        message: `maxHealth must be a positive finite number, got ${fixture.maxHealth}.`,
      }];
    }
  }
  if (fixture.health !== undefined) {
    if (typeof fixture.health !== 'number' || fixture.health < 0 || !Number.isFinite(fixture.health)) {
      errors = [...errors, {
        field: 'health',
        message: `health must be a non-negative finite number, got ${fixture.health}.`,
      }];
    } else if (fixture.health > effectiveMaxHealth) {
      errors = [...errors, {
        field: 'health',
        message: `health (${fixture.health}) cannot exceed maxHealth (${effectiveMaxHealth}).`,
      }];
    }
  }

  // mana / maxMana cross-validation
  const effectiveMaxMana = fixture.maxMana ?? MAGIC.initialMana;
  if (fixture.maxMana !== undefined) {
    if (typeof fixture.maxMana !== 'number' || fixture.maxMana < 0 || !Number.isFinite(fixture.maxMana)) {
      errors = [...errors, {
        field: 'maxMana',
        message: `maxMana must be a non-negative finite number, got ${fixture.maxMana}.`,
      }];
    }
  }
  if (fixture.mana !== undefined) {
    if (typeof fixture.mana !== 'number' || fixture.mana < 0 || !Number.isFinite(fixture.mana)) {
      errors = [...errors, {
        field: 'mana',
        message: `mana must be a non-negative finite number, got ${fixture.mana}.`,
      }];
    } else if (fixture.mana > effectiveMaxMana) {
      errors = [...errors, {
        field: 'mana',
        message: `mana (${fixture.mana}) cannot exceed maxMana (${effectiveMaxMana}).`,
      }];
    }
  }

  // equippedWeaponId — type is string | undefined; null is explicitly invalid
  if ((fixture.equippedWeaponId as unknown) === null) {
    errors = [...errors, {
      field: 'equippedWeaponId',
      message: `equippedWeaponId must be a string or omitted (undefined), but got null. Use undefined to leave the weapon slot empty.`,
    }];
  } else if (fixture.equippedWeaponId !== undefined) {
    if (!ITEM_BY_ID.has(fixture.equippedWeaponId)) {
      errors = [...errors, {
        field: 'equippedWeaponId',
        message: `Unknown item id \"${fixture.equippedWeaponId}\" in equippedWeaponId. Must exist in ITEM_BY_ID.`,
      }];
    } else {
      // Slot compatibility: weapon slot must hold a weapon
      const template = ITEM_BY_ID.get(fixture.equippedWeaponId);
      if (template !== undefined && template.itemClass !== 'weapon') {
        errors = [...errors, {
          field: 'equippedWeaponId',
          message: `Item \"${fixture.equippedWeaponId}\" (itemClass=\"${template.itemClass}\") is not a weapon and cannot be placed in the weapon slot.`,
        }];
      }
    }
  }

  // equippedArmorIds
  if (fixture.equippedArmorIds !== undefined) {
    for (const [slot, itemId] of Object.entries(fixture.equippedArmorIds)) {
      if (itemId !== undefined) {
        if (!ITEM_BY_ID.has(itemId)) {
          errors = [...errors, {
            field: `equippedArmorIds.${slot}`,
            message: `Unknown item id \"${itemId}\" in equippedArmorIds.${slot}. Must exist in ITEM_BY_ID.`,
          }];
        } else {
          // Slot compatibility: armor slots must hold armor items;
          // secondaryWeapon slot accepts weapons as well
          const template = ITEM_BY_ID.get(itemId);
          if (template !== undefined) {
            const isSecondaryWeapon = slot === 'secondaryWeapon';
            const allowedClass = (isSecondaryWeapon === true) ? 'weapon' : 'armor';
            if (template.itemClass !== allowedClass) {
              errors = [...errors, {
                field: `equippedArmorIds.${slot}`,
                message: `Item \"${itemId}\" (itemClass=\"${template.itemClass}\") is not ${(isSecondaryWeapon === true) ? 'a weapon' : 'an armor item'} and cannot be placed in the ${slot} slot.`,
              }];
            }
          }
        }
      }
    }
  }

  // activeEquipmentIds (ring slots)
  if (fixture.activeEquipmentIds !== undefined) {
    for (const [slot, itemId] of Object.entries(fixture.activeEquipmentIds)) {
      if (itemId !== undefined) {
        if (!ITEM_BY_ID.has(itemId)) {
          errors = [...errors, {
            field: `activeEquipmentIds.${slot}`,
            message: `Unknown item id \"${itemId}\" in activeEquipmentIds.${slot}. Must exist in ITEM_BY_ID.`,
          }];
        } else {
          // Slot compatibility: ring slots must hold armor items with armorSlot === 'ring'
          const template = ITEM_BY_ID.get(itemId);
          if (template !== undefined) {
            if (template.itemClass !== 'armor') {
              errors = [...errors, {
                field: `activeEquipmentIds.${slot}`,
                message: `Item \"${itemId}\" (itemClass=\"${template.itemClass}\") is not an armor/ring item and cannot be placed in the ${slot} slot.`,
              }];
            } else {
              // Verify it's actually a ring (armorSlot === 'ring')
              const armorTemplate = template as { itemClass: 'armor'; armor: { slot: string } };
              if ('armor' in armorTemplate && armorTemplate.armor.slot !== 'ring') {
                errors = [...errors, {
                  field: `activeEquipmentIds.${slot}`,
                  message: `Item \"${itemId}\" (armorSlot=\"${armorTemplate.armor.slot}\") is not a ring and cannot be placed in the ${slot} slot.`,
                }];
              }
            }
          }
        }
      }
    }
  }

  // inventoryItemIds
  if (fixture.inventoryItemIds !== undefined) {
    for (let i = 0; i < fixture.inventoryItemIds.length; i++) {
      const itemId = fixture.inventoryItemIds[i]!;
      if (!ITEM_BY_ID.has(itemId)) {
        errors = [...errors, {
          field: `inventoryItemIds[${i}]`,
          message: `Unknown item id \"${itemId}\" at inventoryItemIds[${i}]. Must exist in ITEM_BY_ID.`,
        }];
      }
    }
  }

  // knownRingSchools
  if (fixture.knownRingSchools !== undefined) {
    for (const school of fixture.knownRingSchools) {
      if (!RING_SCHOOL_BY_ID.has(school)) {
        errors = [...errors, {
          field: 'knownRingSchools',
          message: `Unknown ring school \"${school}\" in knownRingSchools. Valid schools: ${[...RING_SCHOOL_BY_ID.keys()].join(', ')}.`,
        }];
      }
    }
  }

  // ringMastery: widen to unknown so all defensive null/type checks are genuinely
  // necessary to TypeScript — fixture data may be malformed JSON at runtime.
  const ringMasteryRaw: unknown = fixture.ringMastery;
  if (ringMasteryRaw === null) {
    errors = [...errors, {
      field: 'ringMastery',
      message: `ringMastery must not be null; use undefined to omit it.`,
    }];
  } else if (ringMasteryRaw !== undefined) {
    // Validate that ringMastery is an object
    if (typeof ringMasteryRaw !== 'object' || Array.isArray(ringMasteryRaw)) {
      errors = [...errors, {
        field: 'ringMastery',
        message: `ringMastery must be an object or undefined, got ${typeof ringMasteryRaw}.`,
      }];
    } else {
      for (const [school, mastery] of Object.entries(ringMasteryRaw as Record<string, unknown>)) {
        if (!RING_SCHOOL_BY_ID.has(school)) {
          errors = [...errors, {
            field: `ringMastery.${school}`,
            message: `Unknown ring school \"${school}\" in ringMastery. Valid schools: ${[...RING_SCHOOL_BY_ID.keys()].join(', ')}.`,
          }];
        }
        // Validate mastery value: must be an object with numeric xp field
        const masteryRecord = mastery !== null && typeof mastery === 'object' && !Array.isArray(mastery)
          ? (mastery as Record<string, unknown>)
          : null;
        const xp: unknown = masteryRecord !== null ? masteryRecord['xp'] : undefined;
        const xpIsInvalid = masteryRecord === null
          || typeof xp !== 'number'
          || !Number.isFinite(xp)
          || xp < 0;
        if (xpIsInvalid === true) {
          errors = [...errors, {
            field: `ringMastery.${school}`,
            message: `ringMastery.${school} must be { xp: <non-negative number> }, got ${mastery === null ? 'null' : typeof mastery}.`,
          }];
        } else {
          // Validate optional level field: must be a positive integer when present
          // masteryRecord is guaranteed non-null here (xpIsInvalid is false implies masteryRecord !== null)
          const levelValue: unknown = masteryRecord['level'];
          if (levelValue !== undefined) {
            const levelIsInvalid = typeof levelValue !== 'number'
              || !Number.isFinite(levelValue)
              || !Number.isInteger(levelValue)
              || levelValue < 1;
            if (levelIsInvalid === true) {
              errors = [...errors, {
                field: `ringMastery.${school}`,
                message: `ringMastery.${school}.level must be a positive integer when present, got ${JSON.stringify(levelValue)}.`,
              }];
            }
          }
        }
      }
    }
  }

  // learnedRingSpellIds
  if (fixture.learnedRingSpellIds !== undefined) {
    for (let i = 0; i < fixture.learnedRingSpellIds.length; i++) {
      const spellId = fixture.learnedRingSpellIds[i]!;
      if (!RING_SPELL_BY_ID.has(spellId)) {
        errors = [...errors, {
          field: `learnedRingSpellIds[${i}]`,
          message: `Unknown ring spell id \"${spellId}\" at learnedRingSpellIds[${i}]. Must exist in RING_SPELL_BY_ID.`,
        }];
      }
    }
  }

  // Duplicate equipment detection: collect all specified item IDs across equipment slots
  let equippedItemIds: string[] = [];
  if (fixture.equippedWeaponId !== undefined) {
    equippedItemIds = [...equippedItemIds, fixture.equippedWeaponId];
  }
  if (fixture.equippedArmorIds !== undefined) {
    for (const itemId of Object.values(fixture.equippedArmorIds)) {
      if (itemId !== undefined) equippedItemIds = [...equippedItemIds, itemId];
    }
  }
  if (fixture.activeEquipmentIds !== undefined) {
    for (const itemId of Object.values(fixture.activeEquipmentIds)) {
      if (itemId !== undefined) equippedItemIds = [...equippedItemIds, itemId];
    }
  }
  const seen = new Set<string>();
  for (const itemId of equippedItemIds) {
    if (seen.has(itemId)) {
      errors = [...errors, {
        field: 'equipment',
        message: `Duplicate equipment item id \"${itemId}\" appears in multiple equipment slots.`,
      }];
      break;
    }
    seen.add(itemId);
  }

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

/** Compute max health for a given level using base stats + level-up gains. */
function computeMaxHealth(level: number): number {
  return BASE_PLAYER_STATS.maxHealth + LEVEL_UP_GAINS.maxHealth * Math.max(0, level - 1);
}

/** Build a FixtureLoadResult (Player + ItemRegistry) from a validated fixture. */
function buildPlayerResult(fixture: PlayerFixture): FixtureLoadResult {
  const level = fixture.level;
  const maxHealth = fixture.maxHealth ?? computeMaxHealth(level);
  const health = fixture.health ?? maxHealth;
  const maxMana = fixture.maxMana ?? MAGIC.initialMana;
  const mana = fixture.mana ?? maxMana;

  // Compute base stats incorporating level-up gains
  const baseStats = {
    ...BASE_PLAYER_STATS,
    maxHealth,
    health,
    attack: BASE_PLAYER_STATS.attack + LEVEL_UP_GAINS.attack * (level - 1),
    defense: BASE_PLAYER_STATS.defense + LEVEL_UP_GAINS.defense * (level - 1),
    accuracy: BASE_PLAYER_STATS.accuracy + LEVEL_UP_GAINS.accuracy * (level - 1),
    evasion: BASE_PLAYER_STATS.evasion + LEVEL_UP_GAINS.evasion * (level - 1),
    speed: BASE_PLAYER_STATS.speed,
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

  // Item registry accumulator — maps EntityId → AnyItemTemplate
  const mutableRegistryEntries: Array<[EntityId, AnyItemTemplate]> = [];

  // Helper: assign an EntityId and register item template
  function assignAndRegister(contentItemId: string, prefix: string): EntityId {
    const eid = nextId(prefix);
    const template = ITEM_BY_ID.get(contentItemId);
    if (template !== undefined) {
      mutableRegistryEntries.push([eid, template]);
    }
    return eid;
  }

  // Build equipment slots
  const equipmentWeaponId = fixture.equippedWeaponId !== undefined
    ? assignAndRegister(fixture.equippedWeaponId, 'weapon')
    : null;

  const equipmentChestId = fixture.equippedArmorIds?.chest !== undefined
    ? assignAndRegister(fixture.equippedArmorIds.chest, 'chest')
    : null;

  const equipmentHeadId = fixture.equippedArmorIds?.head !== undefined
    ? assignAndRegister(fixture.equippedArmorIds.head, 'head')
    : null;

  const equipmentGlovesId = fixture.equippedArmorIds?.gloves !== undefined
    ? assignAndRegister(fixture.equippedArmorIds.gloves, 'gloves')
    : null;

  const equipmentBootsId = fixture.equippedArmorIds?.boots !== undefined
    ? assignAndRegister(fixture.equippedArmorIds.boots, 'boots')
    : null;

  const equipmentSecondaryWeaponId = fixture.equippedArmorIds?.secondaryWeapon !== undefined
    ? assignAndRegister(fixture.equippedArmorIds.secondaryWeapon, 'secondary')
    : null;

  const equipmentRing1Id = fixture.activeEquipmentIds?.ring1 !== undefined
    ? assignAndRegister(fixture.activeEquipmentIds.ring1, 'ring1')
    : null;

  const equipmentRing2Id = fixture.activeEquipmentIds?.ring2 !== undefined
    ? assignAndRegister(fixture.activeEquipmentIds.ring2, 'ring2')
    : null;

  const equipment: Equipment = {
    weapon: equipmentWeaponId,
    secondaryWeapon: equipmentSecondaryWeaponId,
    chest: equipmentChestId,
    head: equipmentHeadId,
    gloves: equipmentGlovesId,
    boots: equipmentBootsId,
    ring1: equipmentRing1Id,
    ring2: equipmentRing2Id,
  };

  // Build inventory with registered item templates
  const inventory: EntityId[] = (fixture.inventoryItemIds ?? []).map((contentItemId, idx) => {
    const eid = entityId(`fixture_inv_${idx + 1}`);
    const template = ITEM_BY_ID.get(contentItemId);
    if (template !== undefined) {
      mutableRegistryEntries.push([eid, template]);
    }
    return eid;
  });

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

  const itemRegistry = { items: new Map(mutableRegistryEntries) };

  return { player, itemRegistry };
}
