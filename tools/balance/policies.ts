import type { GameCommand } from '@dungeon/contracts';
import type { GameView, AvailableAction } from '@dungeon/presenter';
import type { RNG } from '@dungeon/contracts';

/**
 * Policy IDs: distinct AI strategies for testing balance and decision impact.
 */
export type PolicyId =
  | 'aggressive'
  | 'cautious'
  | 'greedy'
  | 'survivalist'
  | 'ability-heavy'
  | 'resource-conserving'
  | 'imperfect-human';

/**
 * Policy definition: decision weights, noise, and heuristics.
 */
interface PolicyDef {
  id: PolicyId;
  decisionNoise: number; // [0.0-1.0]: probability of picking suboptimal action
  decide: (view: GameView, rng: RNG, noise: number) => GameCommand | null;
}

/**
 * Apply noise to a ranked action list: pick from top-N suboptimal actions.
 * This models realistic play: players don't always pick the mathematically optimal move,
 * but they rarely pick garbage either.
 */
function applyNoise(ranked: readonly GameCommand[], rng: RNG, noise: number): GameCommand {
  if (rng.chance(noise * 100)) {
    // Pick from top-3 suboptimal actions (not random garbage)
    const suboptimal = ranked.slice(1, 4);
    return suboptimal.length > 0 ? rng.pick(suboptimal) : ranked[0]!;
  }
  return ranked[0]!;
}

// ─────────────────────────────────────────────────────────────────
// AGGRESSIVE: Attack first, never retreat, ignore heals
// ─────────────────────────────────────────────────────────────────

const aggressive: PolicyDef = {
  id: 'aggressive',
  decisionNoise: 0.05,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];

    // Rank: attack > ability > wait
    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    const ability = enabled.find(a => a.id?.startsWith('ability-') === true);
    if (ability !== null && ability !== undefined) {
      mutableRanked.push({ type: 'USE_ABILITY', abilityId: '', targetId: '' }); // stub
    }

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

// ─────────────────────────────────────────────────────────────────
// CAUTIOUS: Retreat < 50%, use heals immediately, avoid multi-enemy
// ─────────────────────────────────────────────────────────────────

const cautious: PolicyDef = {
  id: 'cautious',
  decisionNoise: 0.05,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];
    const hpPct = view.player.health / view.player.maxHealth;

    // Rank: heal (if <50%) > retreat (if <50%) > move > attack
    if (hpPct < 0.5) {
      const heal = enabled.find(a => a.id === 'use_item' && a.label?.includes('Heal') === true);
      if (heal !== null && heal !== undefined) {
        mutableRanked.push({ type: 'USE_ITEM', itemId: '' }); // stub
      }
    }

    if (hpPct < 0.5) {
      const retreat = enabled.find(a => a.id === 'retreat');
      if (retreat !== null && retreat !== undefined) {
        mutableRanked.push({ type: 'RETREAT' });
      }
    }

    const move = enabled.find(a => a.id === 'move');
    if (move !== null && move !== undefined) {
      mutableRanked.push({ type: 'MOVE', targetPos: { x: 0, y: 0 } }); // stub
    }

    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

// ─────────────────────────────────────────────────────────────────
// GREEDY: Equip → consumable → ability → attack priority
// ─────────────────────────────────────────────────────────────────

const greedy: PolicyDef = {
  id: 'greedy',
  decisionNoise: 0.10,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];

    // Rank: equip > consumable > ability > attack > wait
    const equip = enabled.find(a => a.id?.startsWith('equip-') === true);
    if (equip !== null && equip !== undefined) {
      mutableRanked.push({ type: 'EQUIP', itemId: '' }); // stub
    }

    const consumable = enabled.find(a => a.id === 'use_item');
    if (consumable !== null && consumable !== undefined) {
      mutableRanked.push({ type: 'USE_ITEM', itemId: '' }); // stub
    }

    const ability = enabled.find(a => a.id?.startsWith('ability-') === true);
    if (ability !== null && ability !== undefined) {
      mutableRanked.push({ type: 'USE_ABILITY', abilityId: '', targetId: '' }); // stub
    }

    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

// ─────────────────────────────────────────────────────────────────
// SURVIVALIST: Retreat <35%, hoard heals, kite/ranged preferred
// ─────────────────────────────────────────────────────────────────

const survivalist: PolicyDef = {
  id: 'survivalist',
  decisionNoise: 0.10,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];
    const hpPct = view.player.health / view.player.maxHealth;

    // Rank: retreat (<35%) > ranged_ability > kite_move > heal (dying) > attack
    if (hpPct < 0.35) {
      const retreat = enabled.find(a => a.id === 'retreat');
      if (retreat !== null && retreat !== undefined) {
        mutableRanked.push({ type: 'RETREAT' });
      }
    }

    const rangedAbility = enabled.find(a => a.id?.startsWith('ability-') === true && a.label?.includes('Bow') === true);
    if (rangedAbility !== null && rangedAbility !== undefined) {
      mutableRanked.push({ type: 'USE_ABILITY', abilityId: '', targetId: '' }); // stub
    }

    const move = enabled.find(a => a.id === 'move');
    if (move !== null && move !== undefined) {
      mutableRanked.push({ type: 'MOVE', targetPos: { x: 0, y: 0 } }); // stub
    }

    if (hpPct < 0.15) {
      const heal = enabled.find(a => a.id === 'use_item' && a.label?.includes('Heal') === true);
      if (heal !== null && heal !== undefined) {
        mutableRanked.push({ type: 'USE_ITEM', itemId: '' }); // stub
      }
    }

    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

// ─────────────────────────────────────────────────────────────────
// ABILITY-HEAVY: USE_ABILITY on cooldown=0, even suboptimal targets
// ─────────────────────────────────────────────────────────────────

const abilityHeavy: PolicyDef = {
  id: 'ability-heavy',
  decisionNoise: 0.10,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];

    // Rank: ability (ready) > attack > ability (cooldown) > wait
    const readyAbility = enabled.find(a => a.id?.startsWith('ability-') === true);
    if (readyAbility !== null && readyAbility !== undefined) {
      mutableRanked.push({ type: 'USE_ABILITY', abilityId: '', targetId: '' }); // stub
    }

    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    // Note: cooldown abilities would be in unavailable actions; skip here

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

// ─────────────────────────────────────────────────────────────────
// RESOURCE-CONSERVING: Skip shop, conserve gold, ignore consumables unless dying
// ─────────────────────────────────────────────────────────────────

const resourceConserving: PolicyDef = {
  id: 'resource-conserving',
  decisionNoise: 0.05,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];
    const hpPct = view.player.health / view.player.maxHealth;

    // Rank: attack > move > heal (only if dying) > wait
    // Skip shop, skip consumables unless HP < 15%

    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    const move = enabled.find(a => a.id === 'move');
    if (move !== null && move !== undefined) {
      mutableRanked.push({ type: 'MOVE', targetPos: { x: 0, y: 0 } }); // stub
    }

    if (hpPct < 0.15) {
      const heal = enabled.find(a => a.id === 'use_item' && a.label?.includes('Heal') === true);
      if (heal !== null && heal !== undefined) {
        mutableRanked.push({ type: 'USE_ITEM', itemId: '' }); // stub
      }
    }

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

// ─────────────────────────────────────────────────────────────────
// IMPERFECT-HUMAN: Top-3 weighted random, delayed retreat, skips heals sometimes, weapon swap mid-fight
// ─────────────────────────────────────────────────────────────────

const imperfectHuman: PolicyDef = {
  id: 'imperfect-human',
  decisionNoise: 0.30,
  decide: (view: GameView, rng: RNG, noise: number): GameCommand | null => {
    const enabled = view.availableActions.filter(a => a.enabled === true);
    const mutableRanked: GameCommand[] = [];

    // Rank: heal (sometimes skip) > retreat (1-turn delay) > ability > attack > move > wait
    const heal = enabled.find(a => a.id === 'use_item' && a.label?.includes('Heal') === true);
    if (heal !== null && heal !== undefined && rng.chance(60)) {
      // 60% chance to use heal if available (sometimes skip)
      mutableRanked.push({ type: 'USE_ITEM', itemId: '' }); // stub
    }

    const retreat = enabled.find(a => a.id === 'retreat');
    if (retreat !== null && retreat !== undefined) {
      mutableRanked.push({ type: 'RETREAT' }); // No delay modeled yet
    }

    const ability = enabled.find(a => a.id?.startsWith('ability-') === true);
    if (ability !== null && ability !== undefined) {
      mutableRanked.push({ type: 'USE_ABILITY', abilityId: '', targetId: '' }); // stub
    }

    const attack = enabled.find(a => a.id === 'attack');
    if (attack !== null && attack !== undefined) {
      mutableRanked.push({ type: 'ATTACK', targetId: '' }); // stub
    }

    const move = enabled.find(a => a.id === 'move');
    if (move !== null && move !== undefined) {
      mutableRanked.push({ type: 'MOVE', targetPos: { x: 0, y: 0 } }); // stub
    }

    mutableRanked.push({ type: 'WAIT' });

    return mutableRanked.length > 0 ? applyNoise(mutableRanked, rng, noise) : null;
  },
};

/**
 * All 7 policies available for testing.
 */
export const POLICIES: readonly PolicyDef[] = [
  aggressive,
  cautious,
  greedy,
  survivalist,
  abilityHeavy,
  resourceConserving,
  imperfectHuman,
];

/**
 * Get a policy by ID.
 */
export function getPolicyById(id: PolicyId): PolicyDef {
  const policy = POLICIES.find(p => p.id === id);
  if (policy === null || policy === undefined) {
    throw new Error(`Unknown policy: ${id}`);
  }
  return policy;
}

/**
 * Decide next action using the given policy.
 */
export function decideAction(policy: PolicyId, view: GameView, rng: RNG): GameCommand | null {
  const policyDef = getPolicyById(policy);
  return policyDef.decide(view, rng, policyDef.decisionNoise);
}
