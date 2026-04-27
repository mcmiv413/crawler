export const AXE_CLEAVE_DEFINITION = {
    id: 'axe_cleave',
    name: 'Axe Cleave',
    description: 'Strike primary target and all adjacent enemies at 50% damage.',
    tags: ['melee', 'attack'],
    cooldown: 2,
    unlocks: [{ kind: 'mastery', weaponType: 'axe', masteryIndex: 1 }],
    requirements: [
        { kind: 'weapon_type', weaponType: 'axe' },
        { kind: 'has_target' },
        { kind: 'target_in_melee_range' },
    ],
    targeting: { selector: { kind: 'target_plus_adjacent_enemies' } },
    effects: [
        {
            kind: 'attack',
            damageMultiplier: 1.0, // Primary target at full damage; adjacent targets will be reduced to 50% by applyAttack
            trackMastery: true,
        },
    ],
};
//# sourceMappingURL=axe-cleave.js.map