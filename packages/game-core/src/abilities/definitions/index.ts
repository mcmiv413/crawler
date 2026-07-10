import type { AbilityDefinition } from '../types.js';
import { SECOND_WIND_DEFINITION } from './second-wind.js';
import { POWER_STRIKE_DEFINITION } from './power-strike.js';
import { BLADE_BLEED_DEFINITION } from './blade-bleed.js';
import { BLADE_RIPOSTE_DEFINITION } from './blade-riposte.js';
import { BLUDGEON_STAGGER_DEFINITION } from './bludgeon-stagger.js';
import { RANGED_PIN_DEFINITION } from './ranged-pin.js';
import { BLUDGEON_SHATTER_DEFINITION } from './bludgeon-shatter.js';
import { AXE_EXECUTE_DEFINITION } from './axe-execute.js';
import { AXE_CLEAVE_DEFINITION } from './axe-cleave.js';
import { RANGED_VOLLEY_DEFINITION } from './ranged-volley.js';
import { DAGGER_SET_TRAP_DEFINITION } from './dagger-set-trap.js';
import { DAGGER_DISARM_DEFINITION } from './dagger-disarm.js';
import { EMBER_DEFINITION } from './ember.js';
import { HEAT_SURGE_DEFINITION } from './heat-surge.js';
import { CINDER_WAKE_DEFINITION } from './cinder-wake.js';
import { BOLT_DEFINITION } from './bolt.js';
import { THUNDER_STEP_DEFINITION } from './thunder-step.js';
import { ROLLING_THUNDER_DEFINITION } from './rolling-thunder.js';
import { PLASMA_ARC_DEFINITION } from './plasma-arc.js';
import { STORMFIRE_DEFINITION } from './stormfire.js';
import { THUNDERSTORM_DEFINITION } from './thunderstorm.js';

/**
 * All ability definitions.
 * Abilities are added to this array as they are implemented.
 * Phase 1: second_wind, power_strike ✓
 * Phase 2: blade_bleed, bludgeon_stagger, ranged_pin ✓
 * Phase 3: bludgeon_shatter, axe_execute ✓
 * Phase 4: axe_cleave, ranged_volley ✓
 * Phase 5: blade_riposte ✓
 */
export const ALL_ABILITY_DEFINITIONS: readonly AbilityDefinition[] = [
  SECOND_WIND_DEFINITION,
  POWER_STRIKE_DEFINITION,
  BLADE_BLEED_DEFINITION,
  BLADE_RIPOSTE_DEFINITION,
  BLUDGEON_STAGGER_DEFINITION,
  RANGED_PIN_DEFINITION,
  BLUDGEON_SHATTER_DEFINITION,
  AXE_EXECUTE_DEFINITION,
  AXE_CLEAVE_DEFINITION,
  RANGED_VOLLEY_DEFINITION,
  DAGGER_SET_TRAP_DEFINITION,
  DAGGER_DISARM_DEFINITION,
  EMBER_DEFINITION,
  HEAT_SURGE_DEFINITION,
  CINDER_WAKE_DEFINITION,
  BOLT_DEFINITION,
  THUNDER_STEP_DEFINITION,
  ROLLING_THUNDER_DEFINITION,
  PLASMA_ARC_DEFINITION,
  STORMFIRE_DEFINITION,
  THUNDERSTORM_DEFINITION,
];
