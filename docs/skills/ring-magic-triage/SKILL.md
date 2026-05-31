---
name: ring-magic-triage
description: Classify ring-magic work before implementation. Trigger on scope questions such as what files would this spell touch, is this new school just content or platform work, can this reuse an existing ring-spell pattern, what else is needed for a new ring, or if I add a lightning ring with bolt is that starter-only work or does it need a ladder and combo-scope decision. Leave direct authoring prompts like add a new ring or add a new ring spell to adding-ring and adding-spell.
---

# Ring Magic Triage

Classify ring and ring-spell requests before implementation guidance starts. This skill exists to surface the hidden scope that a generic model is likely to miss.

## Load these references when needed

- Read `references/triage-matrix.md` for the classification table, hidden surfaces, and proof homes.
- Read `../../guides/adding-ring-spell.md` for spell-specific authoring details.
- Read `../../guides/adding-ring.md` for full ring-package work.

## Core rules

1. Always classify the ask first. Do not jump straight to file edits or content authoring.
2. Put the work in one of four buckets: pattern reuse, new status or animation, custom mechanic/runtime work, or new-school/combo expansion.
3. If the ask expands into visuals, route to the animation workflow instead of hand-waving it as a single content file.
4. If the ask expands into new runtime/event/presenter/UI behavior, route to the game-mechanic workflow instead of pretending it is still content-only.
5. If the ask introduces a new ring school or combo-school progression, treat it as platform work unless proven otherwise.
6. This skill is the classifier. Direct authoring prompts should land on `adding-ring` or `adding-spell`, which then apply this triage logic internally.

## Classification workflow

1. Decide whether the request is about a **ring package**, a **ring spell**, or **platform behavior**.
2. Check whether an existing ring-spell pattern already covers the mechanic.
3. Check whether the spell adds new status or animation ownership.
4. Check whether the player-visible behavior requires new runtime, events, presenter data, or UI work.
5. Check whether the ask introduces a new school or multi-school gating.
6. Return the classification, hidden surfaces, and the next skill or guide to use.

## The four buckets

### 1. Pattern reuse

Use this when the spell fits an existing ring-spell pattern and does not change platform behavior.

- stay on the ring or ring-spell authoring path
- call out content, runtime definition, contracts, and targeted proofs

### 2. New status or animation work

Use this when the spell adds a new persistent effect or a new visual surface.

- stay on the ring or spell path for authored fields
- route animation specifics through `adding-animation`
- call out status definitions, presenter/status surfaces, and animation proofs

### 3. Custom mechanic or runtime work

Use this when the spell no longer fits existing ring-spell patterns or adds new player-visible behavior.

- keep the ring/spell-specific authored fields in view
- route the runtime/presenter/UI expansion through `adding-game-mechanic`

### 4. New-school or combo-school expansion

Use this when the ask introduces a new school, new damage/progression assumptions, or multi-school gating that current presenter/UI surfaces do not already model cleanly.

- treat the work as platform expansion
- call out school files, helper/runtime assumptions, presenter/UI study gates, and contract allowlists

## Output contract

Return:

- **Classification**: one of the four buckets
- **Why**: one concise rationale tied to repo reality
- **Files/surfaces**: the hidden surfaces that are easy to miss
- **Next route**: `adding-ring`, `adding-spell`, `adding-animation`, `adding-game-mechanic`, or a combination
- **Proof homes**: the test or validation surfaces that match the classification

## Examples

**Example 1:**

Input: "Add a new fire spell that behaves like the existing fire school but with different numbers."

Output:
- Classification: pattern reuse
- Next route: `adding-spell`
- Files/surfaces: spell content, runtime definition, ring-magic contracts, targeted runtime/presenter proofs

**Example 2:**

Input: "Add a new ring spell with a projectile trail and impact burst."

Output:
- Classification: new status or animation work
- Next route: `adding-spell` + `adding-animation`
- Files/surfaces: spell content, runtime definition, animation refs, canvas modules, Three modules if overlay-owned

**Example 3:**

Input: "Add a combo spell that needs two school mastery gates."

Output:
- Classification: new-school or combo-school expansion
- Next route: `adding-spell` + `adding-game-mechanic`
- Files/surfaces: presenter study views, game-view types, ring-spell availability logic, contract allowlists

## Failure modes to avoid

- Do not treat every new spell as pattern reuse.
- Do not miss new-school or combo-school presenter/UI limitations.
- Do not stop at content files when the ask clearly needs animation or mechanic work.
- Do not assume ring-school additions are data-only.
