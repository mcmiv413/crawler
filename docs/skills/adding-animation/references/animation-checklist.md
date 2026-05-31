# Animation Checklist

Use this reference when the request needs exact file targets, repo-specific gotchas, or proof-home selection.

## File map by surface

| Surface | Files |
| --- | --- |
| Content ref | `packages/content/src/animation-refs/{impact,projectile,self,aoe,status,utility}.ts` |
| Generated content index | `packages/content/src/animation-refs/index.ts` |
| Canvas module | `apps/web/src/animations/modules/<module>.ts` |
| Three module | `apps/web/src/rendering/three/modules/<category>/<module>.ts` |
| Generated Three registry | `apps/web/src/rendering/three/generated/index.ts` |
| Overlay wrapper | `apps/web/src/components/ThreeAnimationOverlay.tsx` |
| Overlay implementation | `apps/web/src/rendering/three/ThreeAnimationOverlay.tsx` |
| Compatibility aliases only | `apps/web/src/components/ThreeEffectsOverlay.tsx`, `apps/web/src/rendering/three/ThreeEffectsOverlay.tsx` |
| Overlay helper libs | `apps/web/src/rendering/three/lib/*.ts` |

## Ask-shape decision matrix

| Ask shape | What to do |
| --- | --- |
| Timing tweak only | Update the `AnimationRef`, rerun `pnpm generate:indexes`, keep ref tests green |
| New effect with existing fallback only | Update the ref and canvas module |
| New effect with overlay-owned travel, pulse, flash, or takeover | Update the ref, canvas module if fallback matters, and add/update the Three module |
| Overlay infrastructure helper | Keep it in `three/lib/` and out of registries |

## Non-obvious repo rules

- `impactFrameMs` is the beat anchor for numbers, hit-stop, and flashes.
- `recoveryMs` affects settle time and turn pacing.
- Projectile and aoe refs must explicitly set `suppressActorBump`.
- `pnpm generate:indexes` regenerates both the content animation index and the generated Three registry.
- `apps/web/src/rendering/three-effect-metadata.ts` is derived from the generated registry; do not hand-maintain it.
- `ThreeAnimationOverlay.tsx` owns the one Y-axis conversion point. Modules should not flip Y.
- Use `context.tileSize` instead of hardcoded pixels inside Three modules.
- Canvas remains the fallback path unless the overlay explicitly owns the surface.

## Proof homes

| Proof | When it matters |
| --- | --- |
| `packages/content/src/animation-refs/index.test.ts` | Any ref timing or metadata change |
| `tests/integration/animation-refs-generator.integration.test.ts` | Any generated-registry change |
| `pnpm run check:three-animations` | Any content animation that should have Three coverage |
| `apps/web/src/rendering/three/three-effects.contract.test.ts` | Any new or changed Three module registration |
| `apps/web/src/rendering/three/ThreeAnimationOverlay.test.tsx` | Overlay ownership or module behavior changes |
| `apps/web/src/components/DungeonPhase.test.tsx` | Player-visible renderer ownership wiring |
| `tests/e2e/three-animation-backend.spec.ts` | Browser-level overlay proof for meaningful WebGL-owned behavior |

## Known-bad cases

- Adding a content ref without rerunning the generators
- Adding a Three module but forgetting registry parity checks
- Treating `ThreeEffectsOverlay` aliases as extension points
- Hardcoding pixels in Three modules instead of using `context.tileSize`
- Forgetting `suppressActorBump` for projectile or aoe refs
