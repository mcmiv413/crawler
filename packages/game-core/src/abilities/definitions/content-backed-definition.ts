import type { AbilityDefinition } from '../types.js';

type SharedAbilityMetadata = Pick<AbilityDefinition, 'id' | 'name' | 'description' | 'cooldown'>;
type ContentBackedAbilityOverrides = Omit<AbilityDefinition, keyof SharedAbilityMetadata>;

export function buildContentBackedDefinition(
  contentAbility: SharedAbilityMetadata,
  overrides: ContentBackedAbilityOverrides,
): AbilityDefinition {
  return {
    id: contentAbility.id,
    name: contentAbility.name,
    description: contentAbility.description,
    cooldown: contentAbility.cooldown,
    ...overrides,
  };
}
