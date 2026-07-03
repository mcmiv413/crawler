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
import { getEquipSlotRule, type EquipSlotRuleName } from '../state/equipment-slot-rules.js';
import {
  isFiniteNumber,
  isPositiveInteger,
  isRecord,
  validateContentRef,
} from '../state/validation-guards.js';
import { BaseFixtureLoadError, formatValidationErrors } from './fixture-validation.js';
import type { PlayerFixture, FixtureValidationError, FixtureValidationResult, FixtureLoadResult } from './player-fixture-types.js';

/** Current supported fixture schema version. */
export const FIXTURE_SCHEMA_VERSION = 1;

interface ContentIdArrayMessages<K extends string> {
  readonly invalidArray: (raw: unknown) => string;
  readonly invalidEntryField: (field: string, index: number, value: unknown) => string;
  readonly invalidEntryMessage: (field: string, index: number, value: unknown) => string;
  readonly missingField: (field: string, index: number, value: K) => string;
  readonly missingMessage: (field: string, index: number, value: K, label: string) => string;
}

interface SlotItemRecordOptions {
  readonly field: 'equippedArmorIds' | 'activeEquipmentIds';
  readonly raw: unknown;
  readonly invalidClassMessage: (slot: string, itemId: string, template: AnyItemTemplate) => string;
  readonly invalidArmorSlotMessage?: (slot: string, itemId: string, armorSlot: string) => string;
  readonly fallbackArmorSlot?: string;
  readonly validateKnownArmorSlot?: boolean;
}

function validateContentIdArray<K extends string>(
  field: string,
  raw: unknown,
  registry: { has(value: K): boolean },
  label: string,
  messages: ContentIdArrayMessages<K>,
): FixtureValidationError[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    return [{ field, message: messages.invalidArray(raw) }];
  }

  return raw.flatMap((value: unknown, index: number) =>
    validateContentRef<K, FixtureValidationError>(
      typeof value === 'string'
        ? messages.missingField(field, index, value as K)
        : messages.invalidEntryField(field, index, value),
      value,
      registry,
      label,
      {
        invalidType: invalid => messages.invalidEntryMessage(field, index, invalid),
        missing: missing => messages.missingMessage(field, index, missing, label),
      },
    ),
  );
}

function validateSlotItemRecord({
  field,
  raw,
  invalidClassMessage,
  invalidArmorSlotMessage,
  fallbackArmorSlot,
  validateKnownArmorSlot = false,
}: SlotItemRecordOptions): FixtureValidationError[] {
  if (raw === undefined) return [];
  if (!isRecord(raw)) {
    return [{
      field,
      message: `${field} must be a plain object or omitted, got ${raw === null ? 'null' : typeof raw}.`,
    }];
  }

  return Object.entries(raw).flatMap(([slot, itemId]) => {
    if (itemId === undefined) return [];
    const fieldPath = `${field}.${slot}`;
    const refErrors = validateContentRef<string, FixtureValidationError>(
      fieldPath,
      itemId,
      ITEM_BY_ID,
      'ITEM_BY_ID',
      {
        invalidType: value => `${fieldPath} must be a string item id or undefined, got ${value === null ? 'null' : typeof value}.`,
        missing: value => `Unknown item id \"${value}\" in ${fieldPath}. Must exist in ITEM_BY_ID.`,
      },
    );
    if (refErrors.length > 0) return refErrors;

    const template = ITEM_BY_ID.get(itemId as string);
    if (template === undefined) return [];

    const rule = getEquipSlotRule(slot);
    const expectedClass = rule?.itemClass ?? 'armor';
    if (template.itemClass !== expectedClass) {
      return [{ field: fieldPath, message: invalidClassMessage(slot, itemId as string, template) }];
    }

    const expectedArmorSlot = rule?.itemClass === 'armor'
      ? rule.armorSlot
      : fallbackArmorSlot;
    if (
      expectedArmorSlot !== undefined
      && (fallbackArmorSlot !== undefined || validateKnownArmorSlot === true)
      && getArmorSlot(template) !== expectedArmorSlot
    ) {
      return [{
        field: fieldPath,
        message: invalidArmorSlotMessage?.(slot, itemId as string, getArmorSlot(template) ?? 'unknown')
          ?? `Item \"${itemId as string}\" is not valid for the ${slot} slot.`,
      }];
    }

    return [];
  });
}

function validateEquippedWeaponId(raw: unknown): FixtureValidationError[] {
  if (raw === null) {
    return [{
      field: 'equippedWeaponId',
      message: `equippedWeaponId must be a string or omitted (undefined), but got null. Use undefined to leave the weapon slot empty.`,
    }];
  }
  if (raw === undefined) return [];

  const refErrors = validateContentRef<string, FixtureValidationError>(
    'equippedWeaponId',
    raw,
    ITEM_BY_ID,
    'ITEM_BY_ID',
    value => `Unknown item id \"${String(value)}\" in equippedWeaponId. Must exist in ITEM_BY_ID.`,
  );
  if (refErrors.length > 0) return refErrors;

  const template = ITEM_BY_ID.get(raw as string);
  const rule = getEquipSlotRule('weapon');
  return template !== undefined && rule !== undefined && template.itemClass !== rule.itemClass
    ? [{
        field: 'equippedWeaponId',
        message: `Item \"${raw as string}\" (itemClass=\"${template.itemClass}\") is not a weapon and cannot be placed in the weapon slot.`,
      }]
    : [];
}

function getArmorSlot(template: AnyItemTemplate): string | undefined {
  const armor = (template as { readonly armor?: { readonly slot?: unknown } }).armor;
  return template.itemClass === 'armor' && typeof armor?.slot === 'string'
    ? armor.slot
    : undefined;
}

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
    ...(!isPositiveInteger(fixture.level)
      ? [{
          field: 'level',
          message: `level must be an integer ≥ 1, got ${fixture.level}.`,
        }]
      : []),

    // experience
    ...(fixture.experience !== undefined && (!isFiniteNumber(fixture.experience) || fixture.experience < 0)
      ? [{
          field: 'experience',
          message: `experience must be a non-negative number, got ${fixture.experience}.`,
        }]
      : []),

    // gold
    ...(fixture.gold !== undefined && (!isFiniteNumber(fixture.gold) || fixture.gold < 0)
      ? [{
          field: 'gold',
          message: `gold must be a non-negative number, got ${fixture.gold}.`,
        }]
      : []),

    // maxHealth
    ...(fixture.maxHealth !== undefined && (!isFiniteNumber(fixture.maxHealth) || fixture.maxHealth <= 0)
      ? [{
          field: 'maxHealth',
          message: `maxHealth must be a positive finite number, got ${fixture.maxHealth}.`,
        }]
      : []),

    // health
    ...(fixture.health !== undefined
      ? (!isFiniteNumber(fixture.health) || fixture.health < 0
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
    ...(fixture.maxMana !== undefined && (!isFiniteNumber(fixture.maxMana) || fixture.maxMana < 0)
      ? [{
          field: 'maxMana',
          message: `maxMana must be a non-negative finite number, got ${fixture.maxMana}.`,
        }]
      : []),

    // mana
    ...(fixture.mana !== undefined
      ? (!isFiniteNumber(fixture.mana) || fixture.mana < 0
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
    ...validateEquippedWeaponId(fixture.equippedWeaponId as unknown),

    // equippedArmorIds
    ...validateSlotItemRecord({
      field: 'equippedArmorIds',
      raw: fixture.equippedArmorIds,
      validateKnownArmorSlot: true,
      invalidClassMessage: (slot, itemId, template) => {
        const isSecondaryWeapon = slot === 'secondaryWeapon';
        return `Item \"${itemId}\" (itemClass=\"${template.itemClass}\") is not ${(isSecondaryWeapon === true) ? 'a weapon' : 'an armor item'} and cannot be placed in the ${slot} slot.`;
      },
      invalidArmorSlotMessage: (slot, itemId, armorSlot) =>
        `Item \"${itemId}\" (armorSlot=\"${armorSlot}\") is not valid for the ${slot} slot.`,
    }),

    // activeEquipmentIds (ring slots)
    ...validateSlotItemRecord({
      field: 'activeEquipmentIds',
      raw: fixture.activeEquipmentIds,
      fallbackArmorSlot: 'ring',
      invalidClassMessage: (slot, itemId, template) =>
        `Item \"${itemId}\" (itemClass=\"${template.itemClass}\") is not an armor/ring item and cannot be placed in the ${slot} slot.`,
      invalidArmorSlotMessage: (slot, itemId, armorSlot) =>
        `Item \"${itemId}\" (armorSlot=\"${armorSlot}\") is not a ring and cannot be placed in the ${slot} slot.`,
    }),

    // inventoryItemIds
    ...validateContentIdArray('inventoryItemIds', fixture.inventoryItemIds, ITEM_BY_ID, 'ITEM_BY_ID', {
      invalidArray: raw => `inventoryItemIds must be an array or omitted, got ${typeof raw}.`,
      invalidEntryField: (_field, i) => `inventoryItemIds[${i}]`,
      invalidEntryMessage: (_field, i, value) => `inventoryItemIds[${i}] must be a string, got ${value === null ? 'null' : typeof value}.`,
      missingField: (_field, i) => `inventoryItemIds[${i}]`,
      missingMessage: (_field, i, value) => `Unknown item id \"${value}\" at inventoryItemIds[${i}]. Must exist in ITEM_BY_ID.`,
    }),

    // knownRingSchools
    ...validateContentIdArray('knownRingSchools', fixture.knownRingSchools, RING_SCHOOL_BY_ID, 'RING_SCHOOL_BY_ID', {
      invalidArray: raw => `knownRingSchools must be an array or omitted, got ${typeof raw}.`,
      invalidEntryField: field => field,
      invalidEntryMessage: (_field, _i, value) => `knownRingSchools entries must be strings, got ${value === null ? 'null' : typeof value}.`,
      missingField: field => field,
      missingMessage: (_field, _i, value) => `Unknown ring school \"${value}\" in knownRingSchools. Valid schools: ${[...RING_SCHOOL_BY_ID.keys()].join(', ')}.`,
    }),

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
        const schoolErrors = validateContentRef(
          `ringMastery.${school}`,
          school,
          RING_SCHOOL_BY_ID,
          'RING_SCHOOL_BY_ID',
          () => `Unknown ring school \"${school}\" in ringMastery. Valid schools: ${[...RING_SCHOOL_BY_ID.keys()].join(', ')}.`,
        );
        const masteryRecord = mastery !== null && typeof mastery === 'object' && !Array.isArray(mastery)
          ? (mastery as Record<string, unknown>)
          : null;
        const xp: unknown = masteryRecord !== null ? masteryRecord['xp'] : undefined;
        const xpIsInvalid = masteryRecord === null
          || !isFiniteNumber(xp)
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
          const levelIsInvalid = !isPositiveInteger(levelValue);
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
    ...validateContentIdArray('learnedRingSpellIds', fixture.learnedRingSpellIds, RING_SPELL_BY_ID, 'RING_SPELL_BY_ID', {
      invalidArray: raw => `learnedRingSpellIds must be an array or omitted, got ${typeof raw}.`,
      invalidEntryField: (_field, i) => `learnedRingSpellIds[${i}]`,
      invalidEntryMessage: (_field, i, value) => `learnedRingSpellIds[${i}] must be a string, got ${value === null ? 'null' : typeof value}.`,
      missingField: (_field, i) => `learnedRingSpellIds[${i}]`,
      missingMessage: (_field, i, value) => `Unknown ring spell id \"${value}\" at learnedRingSpellIds[${i}]. Must exist in RING_SPELL_BY_ID.`,
    }),

    // Duplicate equipment detection: collect all specified item IDs across equipment slots
    ...((): FixtureValidationError[] => {
      const armorRaw: unknown = fixture.equippedArmorIds;
      const activeRaw: unknown = fixture.activeEquipmentIds;
      const equippedItemIds: string[] = [
        ...(fixture.equippedWeaponId !== undefined ? [fixture.equippedWeaponId] : []),
        ...(armorRaw !== undefined && armorRaw !== null && typeof armorRaw === 'object' && !Array.isArray(armorRaw)
          ? Object.values(armorRaw as Record<string, unknown>).filter((id): id is string => typeof id === 'string')
          : []),
        ...(activeRaw !== undefined && activeRaw !== null && typeof activeRaw === 'object' && !Array.isArray(activeRaw)
          ? Object.values(activeRaw as Record<string, unknown>).filter((id): id is string => typeof id === 'string')
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
    throw new FixtureLoadError(
      `Invalid player fixture — ${validation.errors.length} error(s):\n${formatValidationErrors(validation.errors)}`,
      validation.errors,
    );
  }

  return buildPlayerResult(fixture);
}

export function loadPlayerFromValidatedFixture(fixture: PlayerFixture): FixtureLoadResult {
  return buildPlayerResult(fixture);
}

/**
 * Error thrown when a fixture fails validation during loading.
 */
export class FixtureLoadError extends BaseFixtureLoadError<FixtureValidationError> {
  constructor(message: string, validationErrors: readonly FixtureValidationError[]) {
    super('FixtureLoadError', message, validationErrors);
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

  const baseStats = {
    ...levelStats,
    maxHealth,
    health,
  };
  const stats = baseStats;

  // Build item registry and equipment, inventory entity IDs
  // We assign deterministic entity IDs using a counter
  let idCounter = 1;
  function nextId(prefix: string): EntityId {
    return entityId(`fixture_${prefix}_${idCounter++}`);
  }

  function assignEntry(contentItemId: string, eid: EntityId): { eid: EntityId; entry: [EntityId, AnyItemTemplate] | undefined } {
    const template = ITEM_BY_ID.get(contentItemId);
    return { eid, entry: template !== undefined ? [eid, template] : undefined };
  }

  const slotFixtures: Array<{
    readonly slot: EquipSlotRuleName;
    readonly itemId: string | undefined;
    readonly idPrefix: string;
  }> = [
    { slot: 'weapon', itemId: fixture.equippedWeaponId, idPrefix: 'weapon' },
    { slot: 'chest', itemId: fixture.equippedArmorIds?.chest, idPrefix: 'chest' },
    { slot: 'head', itemId: fixture.equippedArmorIds?.head, idPrefix: 'head' },
    { slot: 'gloves', itemId: fixture.equippedArmorIds?.gloves, idPrefix: 'gloves' },
    { slot: 'boots', itemId: fixture.equippedArmorIds?.boots, idPrefix: 'boots' },
    { slot: 'secondaryWeapon', itemId: fixture.equippedArmorIds?.secondaryWeapon, idPrefix: 'secondary' },
    { slot: 'ring1', itemId: fixture.activeEquipmentIds?.ring1, idPrefix: 'ring1' },
    { slot: 'ring2', itemId: fixture.activeEquipmentIds?.ring2, idPrefix: 'ring2' },
  ];

  const slotResults = slotFixtures.flatMap(({ slot, itemId, idPrefix }) =>
    itemId !== undefined
      ? [{ slot, result: assignEntry(itemId, nextId(idPrefix)) }]
      : [],
  );

  const equipment: Equipment = {
    weapon: null,
    secondaryWeapon: null,
    chest: null,
    head: null,
    gloves: null,
    boots: null,
    ring1: null,
    ring2: null,
    ...Object.fromEntries(slotResults.map(({ slot, result }) => [slot, result.eid])),
  };

  const inventoryResults = (fixture.inventoryItemIds ?? [])
    .map((contentItemId, idx) => assignEntry(contentItemId, entityId(`fixture_inv_${idx + 1}`)));

  const inventory: EntityId[] = inventoryResults.map(r => r.eid);

  const registryEntries: Array<[EntityId, AnyItemTemplate]> = [
    ...slotResults.flatMap(({ result }) => result.entry != null ? [result.entry] : []),
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
