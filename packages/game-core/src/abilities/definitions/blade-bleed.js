export const BLADE_BLEED_DEFINITION = {
    id: 'blade_bleed',
    name: 'Blade Bleed',
    description: 'A precise strike that guarantees bleeding (2 dmg/turn, 4 turns).',
    tags: ['melee', 'attack'],
    cooldown: 2,
    unlocks: [{ kind: 'mastery', weaponType: 'blade', masteryIndex: 1 }],
    requirements: [
        { kind: 'weapon_type', weaponType: 'blade' },
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
            kind: 'status',
            statusId: 'bleed',
            statusName: 'Bleed',
            trigger: 'on_hit',
            duration: 4,
        },
    ],
};
//# sourceMappingURL=blade-bleed.js.map