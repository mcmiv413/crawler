export const POWER_STRIKE_DEFINITION = {
    id: 'power_strike',
    name: 'Power Strike',
    description: 'Unleash a devastating blow dealing 2× your attack damage.',
    tags: ['melee', 'attack'],
    cooldown: 2,
    unlocks: [{ kind: 'level', minLevel: 2 }],
    requirements: [
        { kind: 'has_target' },
    ],
    targeting: { selector: { kind: 'single_enemy' } },
    effects: [
        {
            kind: 'attack',
            damageMultiplier: 2,
            trackMastery: false,
        },
    ],
};
//# sourceMappingURL=power-strike.js.map