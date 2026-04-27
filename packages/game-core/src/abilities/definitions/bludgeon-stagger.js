export const BLUDGEON_STAGGER_DEFINITION = {
    id: 'bludgeon_stagger',
    name: 'Bludgeon Stagger',
    description: 'A heavy blow with 80% chance to stun (enemy skips next turn).',
    tags: ['melee', 'attack'],
    cooldown: 2,
    unlocks: [{ kind: 'mastery', weaponType: 'bludgeon', masteryIndex: 1 }],
    requirements: [
        { kind: 'weapon_type', weaponType: 'bludgeon' },
        { kind: 'has_target' },
        { kind: 'target_in_melee_range' },
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
            statusId: 'stun',
            statusName: 'Stun',
            trigger: 'on_hit',
            chance: 0.8,
            duration: 1,
        },
    ],
};
//# sourceMappingURL=bludgeon-stagger.js.map