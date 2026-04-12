/** Fallback combat text used when AI narrative is unavailable */

export const ATTACK_HIT_MESSAGES = [
  '{attacker} strikes {defender} for {damage} damage!',
  '{attacker} lands a blow on {defender}, dealing {damage} damage.',
  '{attacker} connects with {defender}! {damage} damage dealt.',
] as const;

export const ATTACK_MISS_MESSAGES = [
  '{attacker} swings at {defender} but misses!',
  '{defender} dodges {attacker}\'s attack.',
  '{attacker}\'s attack goes wide.',
] as const;

export const CRITICAL_HIT_MESSAGES = [
  'Critical hit! {attacker} devastates {defender} for {damage} damage!',
  '{attacker} finds a weak spot — {damage} critical damage to {defender}!',
] as const;

export const DEATH_MESSAGES = [
  '{entity} collapses to the ground, defeated.',
  '{entity} crumbles and falls still.',
  '{entity} is slain.',
] as const;

export const PLAYER_DEATH_MESSAGES = [
  'Darkness overtakes you. Your journey ends here... for now.',
  'You fall to the ground. The dungeon claims another soul.',
  'Your vision fades. The town bell tolls in the distance.',
  'Fell into the abyss — another name lost to the deep.',
  'The darkness swallowed your last breath.',
  'Claimed by the stone-bound guardian.',
  'Consumed by the abyssal maw.',
  'Slain by the silent, unseen blade.',
  'Buried beneath the shattered altar.',
  'Fell into the pit of eternal night.',
  'Claimed by the dungeon\'s unending hunger.',
  'Surrendered to the endless echo.',
] as const;
