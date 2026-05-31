# Ring Authoring Checklist

Use this reference when the prompt needs exact ring-package surfaces or the hidden repo rules that are easy to miss.

## Base package surfaces

| Surface | Files |
| --- | --- |
| Ring item | `packages/content/src/items/armor/<ring>.ts` |
| Ring school mapping | `packages/content/src/ring-schools/<school>.ts` |
| New school union update | `packages/content/src/ring-schools/types.ts` |
| Enchantment grant | `packages/content/src/enchantments/<grant>.ts` |
| Ring spell content | `packages/content/src/ring-spells/<spell>.ts` |
| Spell runtime | `packages/game-core/src/abilities/definitions/<spell>.ts` |
| Equipment grant/revoke | `packages/game-core/src/systems/equipment.ts` |
| Study/runtime surfaces | `packages/game-core/src/systems/town.ts`, `packages/game-core/src/systems/ring-spell-availability.ts` |
| Presenter/UI | `packages/presenter/src/builders/player-hud-builder.ts`, `packages/presenter/src/builders/town-view-builder.ts`, `apps/web/src/components/PlayerHud.tsx`, `apps/web/src/components/TownPhase.tsx`, `apps/web/src/components/CharacterScreen.tsx` |

## Non-obvious repo rules

- Ring items use `armor.slot: 'ring'` with stable `itemId`s.
- Ring-school mappings are source files, not ad hoc config.
- Ring spells are generated into ability exports; do not duplicate them under `packages/content/src/abilities/`.
- Learned spells live in `player.learnedRingSpellIds`.
- School mastery lives in `player.ringMastery`.
- Study is the paid unlock step and does not grant XP.
- Successful casts grant school XP through each spell's authored `xpGainOnCast`.
- Contract allowlists for ring schools are not fully derived; new schools need explicit contract updates.

## Escalation rules

| If the ring ask also needs... | Route |
| --- | --- |
| Spell-only authoring inside an existing package | `adding-spell` |
| New projectile, impact, pulse, aoe, or other visual work | `adding-animation` |
| New runtime, events, presenter data, or UI behavior | `adding-game-mechanic` |
| New school or combo-school platform behavior | `adding-game-mechanic` plus ring-specific school surfaces |

## Proof homes

| Ask shape | Proofs to name |
| --- | --- |
| Standard ring package | `tests/contracts/ring-magic.contract.test.ts` plus targeted runtime/presenter/UI tests |
| New school | `tests/contracts/content-cross-references.contract.test.ts` plus ring-magic and presenter/game-view proofs |
| Animation-heavy ring | spell/ring proofs plus animation ownership proofs |
| Mechanic-heavy ring | feature-chain proofs plus ring-magic contracts |

## Known-bad cases

- Adding the ring item but forgetting the grant enchantment
- Adding the school file but not the union or allowlist implications
- Treating the spell branch as content-only when it clearly needs animation or mechanic work
- Forgetting `pnpm generate:indexes`
