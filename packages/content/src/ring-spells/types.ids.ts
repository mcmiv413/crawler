export const ringSpellIds = {
  bolt: 'bolt',
  cinderWake: 'cinder_wake',
  ember: 'ember',
  heatSurge: 'heat_surge',
  plasmaArc: 'plasma_arc',
  rollingThunder: 'rolling_thunder',
  stormfire: 'stormfire',
  thunderStep: 'thunder_step',
  thunderstorm: 'thunderstorm',
} as const;

export type RingSpellId = (typeof ringSpellIds)[keyof typeof ringSpellIds];
