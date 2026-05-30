export const ringSpellIds = {
  cinderWake: 'cinder_wake',
  ember: 'ember',
  heatSurge: 'heat_surge',
} as const;

export type RingSpellId = (typeof ringSpellIds)[keyof typeof ringSpellIds];
