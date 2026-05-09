/**
 * Content-level item types extending game-contracts types with animation metadata.
 */

import type { ConsumableTemplate } from '@dungeon/contracts';

/**
 * Consumable definition with animation intent declared.
 * Extends the contract type to add optional animation reference.
 */
export interface AnimatedConsumableDefinition extends ConsumableTemplate {
  readonly animation?: { readonly id: string };
}
