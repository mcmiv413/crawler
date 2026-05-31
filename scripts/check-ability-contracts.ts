import { ABILITY_DEFINITIONS, ANIMATION_REF_BY_ID, RING_SPELL_BY_ID } from '@dungeon/content';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SetTrapCommandSchema,
  UseAbilityCommandSchema,
  WEAPON_TYPES,
} from '@dungeon/contracts';
import type { AbilityDefinition } from '@dungeon/content';

type AbilityCommandType = 'USE_ABILITY' | 'SET_TRAP';

interface AbilityContractOverride {
  readonly commandType?: AbilityCommandType;
  readonly requiresDirection?: boolean;
  readonly requiresItemEntityId?: boolean;
  readonly allowTargetAndDirection?: boolean;
  readonly note: string;
}

export interface AbilityContractSnapshot {
  readonly abilities: readonly AbilityDefinition[];
  readonly ringSpells: ReadonlyMap<string, AbilityDefinition>;
  readonly animationIds: ReadonlySet<string>;
  readonly useAbilityFields: ReadonlySet<string>;
  readonly setTrapFields: ReadonlySet<string>;
  readonly validWeaponTypes: ReadonlySet<string>;
}

interface ResolvedAbilityContract {
  readonly abilityId: string;
  readonly commandType: AbilityCommandType;
  readonly requiresTarget: boolean;
  readonly requiresDirection: boolean;
  readonly requiresItemEntityId: boolean;
  readonly allowTargetAndDirection: boolean;
  readonly weaponTypes: readonly string[];
  readonly animationId: string;
}

const ABILITY_CONTRACT_OVERRIDES: Readonly<Record<string, AbilityContractOverride>> = {
  dagger_disarm: {
    requiresDirection: true,
    note:
      'Trap disarm resolves against an adjacent direction even though it still executes through USE_ABILITY.',
  },
  dagger_set_trap: {
    commandType: 'SET_TRAP',
    requiresDirection: true,
    requiresItemEntityId: true,
    note:
      'Trap placement consumes a concrete trap entity and therefore uses the dedicated SET_TRAP command payload.',
  },
};

function getSchemaFields(
  schema: { readonly shape: Record<string, unknown> },
): ReadonlySet<string> {
  return new Set(Object.keys(schema.shape));
}

export function createLiveAbilityContractSnapshot(): AbilityContractSnapshot {
  return {
    abilities: [...ABILITY_DEFINITIONS.values()],
    ringSpells: new Map(RING_SPELL_BY_ID.entries()),
    animationIds: new Set(ANIMATION_REF_BY_ID.keys()),
    useAbilityFields: getSchemaFields(
      UseAbilityCommandSchema as unknown as { readonly shape: Record<string, unknown> },
    ),
    setTrapFields: getSchemaFields(
      SetTrapCommandSchema as unknown as { readonly shape: Record<string, unknown> },
    ),
    validWeaponTypes: new Set(WEAPON_TYPES),
  };
}

function resolveAbilityContract(
  ability: AbilityDefinition,
): ResolvedAbilityContract {
  const override = ABILITY_CONTRACT_OVERRIDES[ability.id];

  return {
    abilityId: ability.id,
    commandType: override?.commandType ?? 'USE_ABILITY',
    requiresTarget: ability.requiresTarget,
    requiresDirection: override?.requiresDirection ?? ability.requiresDirection === true,
    requiresItemEntityId: override?.requiresItemEntityId === true,
    allowTargetAndDirection: override?.allowTargetAndDirection === true,
    weaponTypes: ability.requiresWeaponTypes ?? [],
    animationId: ability.animation.id,
  };
}

function buildRepresentativeCommand(
  contract: ResolvedAbilityContract,
): Record<string, unknown> {
  if (contract.commandType === 'SET_TRAP') {
    return {
      type: 'SET_TRAP',
      direction: 'N',
      itemEntityId: 'trap-entity-1',
    };
  }

  const command: Record<string, unknown> = {
    type: 'USE_ABILITY',
    abilityId: contract.abilityId,
  };

  if (contract.requiresTarget) {
    command.targetId = 'enemy-1';
  }

  if (contract.requiresDirection) {
    command.direction = 'N';
  }

  return command;
}

export function collectAbilityContractFailures(
  snapshot: AbilityContractSnapshot,
): string[] {
  const failures: string[] = [];
  const abilityById = new Map(snapshot.abilities.map(ability => [ability.id, ability] as const));

  for (const ability of snapshot.abilities) {
    const contract = resolveAbilityContract(ability);

    if (snapshot.animationIds.has(contract.animationId) === false) {
      failures.push(
        `${ability.id}: animation "${contract.animationId}" is not declared in animationRefs`,
      );
    }

    if (
      contract.requiresTarget
      && contract.requiresDirection
      && contract.allowTargetAndDirection === false
    ) {
      failures.push(
        `${ability.id}: target + direction payloads require an explicit allowance before both can be mandatory`,
      );
    }

    if (ability.requiresWeaponTypes !== undefined && ability.requiresWeaponTypes.length === 0) {
      failures.push(
        `${ability.id}: requiresWeaponTypes must be omitted or contain at least one valid weapon type`,
      );
    }

    for (const weaponType of contract.weaponTypes) {
      if (snapshot.validWeaponTypes.has(weaponType) === false) {
        failures.push(`${ability.id}: weapon type "${weaponType}" is not part of the public contract`);
      }
    }

    if (contract.requiresTarget && snapshot.useAbilityFields.has('targetId') === false) {
      failures.push(
        `${ability.id}: USE_ABILITY schema must expose targetId for target-required abilities`,
      );
    }

    if (contract.requiresDirection) {
      const directionFields =
        contract.commandType === 'SET_TRAP'
          ? snapshot.setTrapFields
          : snapshot.useAbilityFields;

      if (directionFields.has('direction') === false) {
        failures.push(
          `${ability.id}: ${contract.commandType} schema must expose direction for direction-required abilities`,
        );
      }
    }

    if (contract.commandType === 'SET_TRAP' && contract.requiresItemEntityId) {
      if (snapshot.setTrapFields.has('itemEntityId') === false) {
        failures.push(
          `${ability.id}: SET_TRAP schema must expose itemEntityId for trap placement abilities`,
        );
      }
      if (contract.requiresDirection === false) {
        failures.push(`${ability.id}: SET_TRAP abilities must require direction`);
      }
      if (contract.requiresTarget) {
        failures.push(`${ability.id}: SET_TRAP abilities cannot also require targetId`);
      }
    }

    const representativeCommand = buildRepresentativeCommand(contract);
    const parseResult =
      contract.commandType === 'SET_TRAP'
        ? SetTrapCommandSchema.safeParse(representativeCommand)
        : UseAbilityCommandSchema.safeParse(representativeCommand);
    if (parseResult.success === false) {
      failures.push(
        `${ability.id}: representative ${contract.commandType} payload failed schema validation`,
      );
    }
  }

  for (const [ringSpellId, ringSpell] of snapshot.ringSpells) {
    const ability = abilityById.get(ringSpellId);
    if (ability === undefined) {
      failures.push(`${ringSpellId}: ring spell is missing from ABILITY_DEFINITIONS`);
      continue;
    }
    if (ability !== ringSpell) {
      failures.push(
        `${ringSpellId}: ABILITY_DEFINITIONS must reuse the ring spell definition instead of duplicating it`,
      );
    }
  }

  return failures.sort((left, right) => left.localeCompare(right));
}

function main(): void {
  const failures = collectAbilityContractFailures(createLiveAbilityContractSnapshot());

  if (failures.length > 0) {
    console.error('Ability contract check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Ability contract check passed.');
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main();
}
