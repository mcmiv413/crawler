---
name: adding-animation
description: Add or change an animation in this repo's content plus web-rendering pipeline. Use whenever the prompt asks for a new animation, spell visual, projectile or impact effect, status pulse, self or aoe effect, canvas animation module, or Three overlay coverage, even if the user only says things like "add a new spell animation", "make this hit effect animate", "wire up a new projectile visual", or "give this status a pulse."
---

# Adding Animation

Add or update an animation in the repo's content and web renderer pipelines. This skill is for **animation refs, canvas modules, Three modules, generated registries, and ownership proofs**.

## Load these references when needed

- Read `references/animation-checklist.md` for the file map, decision matrix, and proof homes.
- Read `../../guides/adding-animation.md` when you need the full authoring contract, timing rules, or Three module details.

## Core rules

1. Keep animation refs in `packages/content/src/animation-refs/`. Keep rendering code in `apps/web/`.
2. Reuse an existing animation ref/module when it already matches the player-visible behavior.
3. Classify the ask before editing: ref-only update, canvas-module work, Three-module work, or overlay-owned helper work.
4. Rerun `pnpm generate:indexes` after animation ref or module changes. Do not hand-edit generated registries.
5. Treat Three ownership as explicit. Canvas stays correct unless the overlay owns that surface.
6. Use `apps/web/src/components/ThreeAnimationOverlay.tsx` as the production wrapper. The `ThreeEffectsOverlay` files are compatibility aliases only.
7. Finish on the right proofs for the change, then `pnpm validate`.

## Workflow

1. Identify the animation category: `impact`, `projectile`, `self`, `aoe`, `status`, or `utility`.
2. Decide whether an existing `AnimationRef` and module can be reused.
3. If the ref changes or is new, update the matching source file under `packages/content/src/animation-refs/`.
4. If the canvas animation changes, update or add the module under `apps/web/src/animations/modules/`.
5. If the feature needs overlay-owned WebGL presentation, update or add the Three module under `apps/web/src/rendering/three/modules/<category>/`.
6. Run `pnpm generate:indexes`.
7. Name the exact proof homes: ref tests, generator tests, Three coverage, component ownership, or browser proof.

## Decision points

### Ref-only work

Use this when timing or metadata changes but the existing renderers already match the behavior.

- update the content ref
- keep `durationMs`, `impactFrameMs`, and `recoveryMs` coherent
- explicitly set `suppressActorBump` for projectile and aoe refs

### Canvas-module work

Use this when the 2D fallback path needs a new or changed presentation.

- update the canvas module under `apps/web/src/animations/modules/`
- keep fallback rendering correct even when a Three module will also exist

### Three-module work

Use this when the effect needs richer overlay-owned presentation such as projectile travel, richer impacts, status pulses, combat labels, or takeover behavior.

- add/update the module under `apps/web/src/rendering/three/modules/<category>/`
- size geometry with `context.tileSize`
- do not flip Y inside modules
- do not maintain manual registries or metadata lists

### Overlay-owned helper work

Use this only when the behavior is overlay infrastructure rather than a registered animation module.

- keep helper code in `apps/web/src/rendering/three/lib/`
- do not register it as an animation module
- keep heavy `three` imports inside the overlay-heavy layer

## Output contract

When answering an animation request, return:

- the exact file map
- whether the work is ref-only, canvas, Three, or overlay-helper
- whether an existing animation can be reused
- the generator step
- the proof homes that match the requested behavior

Do not stop at "add an animation ref." The useful answer here is the **full animation ownership path**.

## Examples

**Example 1:**

Input: "Add a new projectile animation for this ring spell."

Output:
- identify `projectile` as the category
- name the `packages/content/src/animation-refs/projectile.ts` surface
- name the canvas module and Three module surfaces if overlay ownership is needed
- require `pnpm generate:indexes`
- name `packages/content/src/animation-refs/index.test.ts`, `tests/integration/animation-refs-generator.integration.test.ts`, and `pnpm run check:three-animations`

**Example 2:**

Input: "Give the burning status a new pulse visual."

Output:
- classify the ask as `status`
- keep gameplay/runtime logic out of scope unless the user explicitly asked for it
- route to status animation surfaces and ownership/component proofs

## Failure modes to avoid

- Do not put rendering logic in `packages/content`.
- Do not hand-edit generated animation registries.
- Do not add new behavior to `ThreeEffectsOverlay` compatibility aliases.
- Do not skip `suppressActorBump` on projectile or aoe refs.
- Do not assume a Three module is optional when the requested behavior needs overlay ownership.
- Do not stop at a content ref when the feature clearly needs canvas or Three code too.
