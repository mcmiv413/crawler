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
/**
 * All ability definitions.
 * Abilities are added to this array as they are implemented.
 * Phase 1: second_wind, power_strike ✓
 * Phase 2: blade_bleed, bludgeon_stagger, ranged_pin ✓
 * Phase 3: bludgeon_shatter, axe_execute ✓
 * Phase 4: axe_cleave, ranged_volley ✓
 * Phase 5: blade_riposte ✓
 */
export const ALL_ABILITY_DEFINITIONS = [
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
];
//# sourceMappingURL=index.js.map