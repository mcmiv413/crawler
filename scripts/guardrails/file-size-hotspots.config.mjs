// File-size guardrail for manually maintained source files.
// Budget: ~500 lines for typical manually-maintained modules.
// Allowlist: Known hotspots with explicit owner-layer rationales from the audit report.

export default {
  // Line budget for manually maintained source files (apps, packages, scripts)
  maxLinesPerFile: 500,

  // Allowed drift (percent of the declared `lines` value) before an allowlist entry's
  // line count must be re-pinned. Lets small edits land without a metadata bump on every change.
  linesTolerancePercent: 5,

  // Scopes to check: when omitted, auto-discovered from rootDir as apps/*/src, packages/*/src, and scripts
  // Override this for tests or custom discovery behavior
  // includedRoots: undefined,

  // Exclude tests, generated, and static artifacts
  excludePatterns: [
    /\.test\.[tj]sx?$/,
    /\.property\.test\.[tj]sx?$/,
    /\.balance\.test\.[tj]sx?$/,
    /\.integration\.test\.[tj]sx?$/,
    /\.contract\.test\.[tj]sx?$/,
    /generated/,
    /-raw\.ts$/,
    /dist\//,
    /node_modules\//,
  ],

  // Allowlist: Known oversized files with audit-report classifications and owner rationales
  allowlistedFiles: [
    {
      path: 'packages/eslint-plugin-dungeon/src/index.ts',
      reason: 'Current tooling hotspot — single entry point for multiple rule definitions with shared type annotations and logic',
      auditReportNote: 'Tooling/infrastructure package; future split seam is moving individual rule implementations into rule modules while preserving the index entry point',
      lines: 920,
    },
    {
      path: 'packages/presenter/src/game-view.ts',
      reason: 'Central DTO/read-model contract surface — consolidation target only if behavior leaks in',
      auditReportNote: 'Acceptable aggregation',
      lines: 575,
    },
    {
      path: 'packages/presenter/src/animation-sequence.ts',
      reason: 'Specialized event scheduling helpers — split by event family if behavior keeps growing',
      auditReportNote: 'Large but specialized',
      lines: 859,
    },
    {
      path: 'apps/web/src/rendering/three/ThreeAnimationOverlay.tsx',
      reason: 'Refactor target (animation overlay coordinator with module registration and status management) — needs module-registration splitting and ownership coordination refactoring',
      auditReportNote: 'Refactor target — action item from audit section 3B (animation-system refactoring backlog)',
      lines: 921,
    },
    {
      path: 'apps/web/src/components/TownPhase.tsx',
      reason: 'Refactor target (town screen coordinator with multiple subpanels) — needs panel composition splitting into discrete town-phase component modules',
      auditReportNote: 'Refactor target — action item from audit section 2B (ui-component composition refactoring backlog)',
      lines: 710,
    },
    {
      path: 'apps/web/src/components/CharacterScreen.tsx',
      reason: 'Refactor target (large section-heavy screen) — needs panel composition splitting',
      auditReportNote: 'Refactor target — action item',
      lines: 619,
    },
    {
      path: 'apps/web/src/App.tsx',
      reason: 'Refactor target (routes panels, phases, overlays from app shell) — needs phase containers + panel composition helpers',
      auditReportNote: 'Refactor target — action item',
      lines: 577,
    },
    {
      path: 'packages/game-core/src/systems/ambient-behavior-engine.ts',
      reason: 'Refactor target (combines scoring, social analysis, transitions, selection) — needs scoring/analysis/transition helper extraction',
      auditReportNote: 'Refactor target — action item',
      lines: 516,
    },
    {
      path: 'packages/game-core/src/systems/town.ts',
      reason: 'Refactor target (town action coordinator with validation, shop, rest, study, and enchantment flows) — needs split into discrete town transaction modules',
      auditReportNote: 'Correctness audit patch added rejection and gold-change observability; split is unrelated to this bugfix scope',
      lines: 514,
    },
    {
      path: 'packages/game-core/src/engine/turn-scheduler.ts',
      reason: 'Refactor target — orchestration file candidate for split into discrete scheduler/turn-advance modules',
      auditReportNote: 'Refactor target — action item',
      lines: 572,
    },
    {
      path: 'scripts/balance/simulation.ts',
      reason: 'Refactor target — candidate for split into discrete balance/analysis modules',
      auditReportNote: 'Refactor target — action item',
      lines: 516,
    },
    {
      path: 'packages/game-contracts/src/events/index.ts',
      reason: 'Central discriminated union of all domain events — consolidation target for event type safety',
      auditReportNote: 'Event type definitions added for player action observability guardrails; Phase 4A adds MovementBlockedEvent; Phase 4B adds TrapDisarmedEvent and TrapPlacedEvent; acceptable aggregation',
      lines: 602,
    },
    {
      path: 'scripts/audit-player-action-noops.ts',
      reason: 'Audit script with comprehensive classification taxonomy — centralizes all Phase 1+2+3 silent-failure pattern categories (P/G/A/D/B) and KNOWN_PATTERNS registry with Phase summary reporting',
      auditReportNote: 'Guardrails infrastructure; Phase 2 adds 20 rejection codes (4 slices); Phase 3 adds combat observability (apply-attack.ts invalid target); Phase 4A adds movement-blocked protected path; KNOWN_PATTERNS registry updated with corrected line numbers; future split seam is separating KNOWN_PATTERNS into dedicated JSON config once taxonomy stabilizes',
      lines: 910,
    },
    {
      path: 'scripts/check-test-quality.mjs',
      reason: 'Guardrail script with cohesive changed-file discovery, AST checks, and rich repair-message formatting for test-quality enforcement',
      auditReportNote: 'Probity-inspired native test-quality gate; future split seam is extracting AST helpers and individual rule checks if policy grows past the initial rollout',
      lines: 800,
    },
    {
      path: 'packages/game-core/src/fixtures/scenario-fixture-validation.ts',
      reason: 'Scenario fixture validator — consolidates player/world resolution plus map, enemy, loot, interactable, and spawn placement validation against untrusted JSON',
      auditReportNote: 'Fixture hardening for PR #36 review: resolveScenarioPlayer/resolveScenarioWorld now guard that ref is a non-empty string and that inline fixtures and resolver return values are objects before downstream validation; validateMapAndPlacements bails out on invalid width/height and only treats array map.floors as explicit floors; future split seam is extracting per-placement validators into discrete modules',
      lines: 638,
    },
    {
      path: 'packages/game-core/src/fixtures/player-fixture-loader.ts',
      reason: 'Player fixture loader: each field in the player fixture requires explicit unknown-safe validation (equippedArmorIds, activeEquipmentIds, inventoryItemIds, knownRingSchools, learnedRingSpellIds) to avoid throwing on malformed JSON. Shrink seam is extracting per-field validators into discrete modules.',
      auditReportNote: 'PR #37 review hardening: guarded Object.entries/Object.values calls and Array.isArray checks to prevent validator throws on non-object/non-array malformed fixture fields',
      lines: 568,
    },
    {
      path: 'packages/game-core/src/state/save-snapshot-validation.ts',
      reason: 'Save snapshot validation: each field type in SaveSnapshot requires explicit per-field validation (enemies, persistedFloorCache depth keys, storedFloor sub-fields, equipment slot compatibility, ring spell IDs). Shrink seam is splitting into domain-specific sub-validators once the ring migration and floor-cache redesign settle.',
      lines: 698,
    },
  ],
};
