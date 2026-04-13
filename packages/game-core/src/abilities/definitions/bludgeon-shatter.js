export const BLUDGEON_SHATTER_DEFINITION = {
    id: 'bludgeon_shatter',
    name: 'Bludgeon Shatter',
    description: 'Smash through armor, permanently reducing target defense by 5.',
    tags: ['melee', 'attack'],
    cooldown: 4,
    unlocks: [{ kind: 'mastery', weaponType: 'bludgeon', masteryIndex: 2 }],
    requirements: [
        { kind: 'weapon_type', weaponType: 'bludgeon' },
        { kind: 'has_target' },
    ],
    targeting: { selector: { kind: 'single_enemy' } },
    effects: [
        {
            kind: 'attack',
            damageMultiplier: 1,
            trackMastery: true,
        },
        {
            kind: 'modify_stat',
            stat: 'defense',
            operation: 'subtract',
            amount: 5,
            trigger: 'on_hit',
            duration: 'permanent',
            minimum: 0,
        },
    ],
};
//# sourceMappingURL=bludgeon-shatter.js.map