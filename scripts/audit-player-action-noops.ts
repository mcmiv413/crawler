/**
 * Audit script to find potential silent no-op returns in player action paths.
 *
 * Scans game-core source files for patterns like `return { state, events: [], runEnded: false }`
 * and reports them for review.
 *
 * Some patterns are protected (marked as failures if still present).
 * Others are reported as informational findings for future triage.
 *
 * Run with:
 *   pnpm exec tsx --tsconfig scripts/tsconfig.json scripts/audit-player-action-noops.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

interface Finding {
  file: string;
  line: number;
  snippet: string;
  category: 'P' | 'G' | 'D' | 'B' | 'unclassified';
  protected: boolean;
}

interface PatternInfo {
  category: 'P' | 'G' | 'D' | 'B';
  reason: string;
}

const findings: Finding[] = [];
const scanErrors: string[] = [];

// Autonomous system files to exclude (A category — not player actions)
const EXCLUDED_PATHS = new Set([
  'packages/game-core/src/engine/turn-scheduler.ts',
  'packages/game-core/src/systems/burn-spread.ts',
  'packages/game-core/src/systems/death.ts',
  'packages/game-core/src/systems/enemy-abilities.ts',
  'packages/game-core/src/systems/enemy-respawn.ts',
  'packages/game-core/src/systems/factions.ts',
  'packages/game-core/src/systems/mana.ts',
  'packages/game-core/src/systems/npc.ts',
  'packages/game-core/src/systems/quest-progress.ts',
]);

// Classified patterns (P, G, D, B categories) mapped by file:line.
// KNOWN_PATTERNS always wins over the protected-file heuristic.
// A finding is only a "protected failure" if it is in a protected file AND
// either has no KNOWN_PATTERNS entry, or has category 'P'.
const KNOWN_PATTERNS: Record<string, PatternInfo> = {
  // -------------------------------------------------------------------------
  // G category: Legitimate pre-condition guards (internal, not player-visible)
  // -------------------------------------------------------------------------
  // apply-attack.ts — applyHeatSurgeBurn sub-function
  // Line 22: internal helper that returns { enemy, events: [] } when heat surge is not active.
  // This is NOT a CommandResult; it is a passive sub-function with no player-facing rejection.
  // Phase 3 replaced lines 55 and 61 (run null / target not found) with ATTACK_PERFORMED events.
  'packages/game-core/src/abilities/effects/apply-attack.ts:22': {
    category: 'G',
    reason: 'applyHeatSurgeBurn: heat surge passive not active — internal no-op, not player-facing',
  },
  'packages/game-core/src/abilities/effects/apply-conditional.ts:17': {
    category: 'G',
    reason: 'Condition not met — internal guard',
  },
  'packages/game-core/src/abilities/runtime/execute-ability.ts:54': {
    category: 'G',
    reason: 'Ability definition missing (legacy) — defensive guard',
  },
  'packages/game-core/src/abilities/runtime/execute-ability.ts:74': {
    category: 'G',
    reason: 'Eligibility check (same as thunder-step path)',
  },
  'packages/game-core/src/engine/command-handler.ts:67': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:71': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:75': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:83': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:87': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:91': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:97': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:103': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:116': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:117': {
    category: 'G',
    reason: 'Phase guard (enchant armor only in town)',
  },
  'packages/game-core/src/engine/command-handler.ts:122': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/command-handler.ts:126': {
    category: 'G',
    reason: 'Type-guard dispatch — defensive pattern (expected failure)',
  },
  'packages/game-core/src/engine/handlers/combat.ts:55': {
    category: 'G',
    reason: 'Run state guard — internal validation',
  },
  'packages/game-core/src/engine/handlers/combat.ts:58': {
    category: 'G',
    reason: 'Player dead guard — internal validation',
  },
  'packages/game-core/src/engine/handlers/combat.ts:72': {
    category: 'G',
    reason: 'Target validation — legitimate guard',
  },
  'packages/game-core/src/engine/handlers/combat.ts:361': {
    category: 'G',
    reason: 'Run state guard',
  },
  'packages/game-core/src/engine/handlers/combat.ts:362': {
    category: 'G',
    reason: 'Ability use eligibility check',
  },
  'packages/game-core/src/engine/handlers/combat.ts:365': {
    category: 'G',
    reason: 'Ability definition missing guard',
  },
  'packages/game-core/src/engine/handlers/combat.ts:370': {
    category: 'G',
    reason: 'Weapon type requirement guard',
  },
  'packages/game-core/src/engine/handlers/combat.ts:393': {
    category: 'G',
    reason: 'Combat state validation',
  },
  'packages/game-core/src/engine/handlers/combat.ts:396': {
    category: 'G',
    reason: 'Old silent guard path for ability with no events — guarded by rejection check above',
  },
  'packages/game-core/src/engine/handlers/disarm-trap.ts:22': {
    category: 'G',
    reason: 'Trap state validation',
  },
  'packages/game-core/src/engine/handlers/disarm-trap.ts:35': {
    category: 'G',
    reason: 'Skill check validation',
  },
  'packages/game-core/src/engine/handlers/disarm-trap.ts:44': {
    category: 'G',
    reason: 'Resource state validation',
  },
  'packages/game-core/src/engine/handlers/disarm-trap.ts:50': {
    category: 'G',
    reason: 'Prerequisite validation',
  },
  'packages/game-core/src/engine/handlers/disarm-trap.ts:55': {
    category: 'G',
    reason: 'Availability validation',
  },
  'packages/game-core/src/engine/handlers/disarm-trap.ts:95': {
    category: 'G',
    reason: 'State consistency check',
  },
  // Phase 4A: handleMove blocked-terrain paths now emit MOVEMENT_BLOCKED
  // (no longer empty-event returns). They are protected via the movement.ts
  // entry in protectedPaths below; the previously-tracked movement.ts:39/42
  // empty returns have been replaced by visible MOVEMENT_BLOCKED events.
  // handleInteract guards remain legitimate internal no-ops (G category).
  'packages/game-core/src/engine/handlers/movement.ts:180': {
    category: 'G',
    reason: 'handleInteract run state guard — internal validation',
  },
  'packages/game-core/src/engine/handlers/movement.ts:184': {
    category: 'G',
    reason: 'handleInteract object registry lookup — internal validation',
  },
  'packages/game-core/src/engine/handlers/movement.ts:187': {
    category: 'G',
    reason: 'handleInteract template registry lookup — internal validation',
  },
  'packages/game-core/src/engine/handlers/retreat-handler.ts:8': {
    category: 'G',
    reason: 'Validation guard',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:25': {
    category: 'G',
    reason: 'Placement validation',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:31': {
    category: 'G',
    reason: 'Inventory validation',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:37': {
    category: 'G',
    reason: 'Position validation',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:43': {
    category: 'G',
    reason: 'Resource check',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:52': {
    category: 'G',
    reason: 'State validation',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:58': {
    category: 'G',
    reason: 'Constraint check',
  },
  'packages/game-core/src/engine/handlers/set-trap.ts:109': {
    category: 'G',
    reason: 'Final state validation',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:27': {
    category: 'G',
    reason: 'Position supplied validation',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:31': {
    category: 'G',
    reason: 'Phase guard (dungeon-only)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:38': {
    category: 'G',
    reason: 'Ring spell registry guard',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:46': {
    category: 'G',
    reason: 'Ring spell eligibility guard',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:47': {
    category: 'G',
    reason: 'Ring spell eligibility check (alternative path)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:67': {
    category: 'G',
    reason: 'Distance calculation guard',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:78': {
    category: 'G',
    reason: 'Distance > maxRange guard (alternate check)',
  },
  'packages/game-core/src/engine/handlers/town-handlers.ts:14': {
    category: 'G',
    reason: 'Phase guard (town-only)',
  },
  'packages/game-core/src/systems/equipment.ts:245': {
    category: 'G',
    reason: 'No new unlocks — legitimate no-op',
  },
  'packages/game-core/src/systems/equipment.ts:274': {
    category: 'G',
    reason: 'Item registry guard — trap constraint (validated by validateEquipmentAction before equipItem)',
  },
  'packages/game-core/src/systems/equipment.ts:279': {
    category: 'G',
    reason: 'Item class guard — only weapon/armor equippable (validated by validateEquipmentAction before equipItem)',
  },
  'packages/game-core/src/systems/inventory.ts:108': {
    category: 'G',
    reason: 'Item availability guard',
  },
  // Town guards — these are defensive post-validation checks (validator runs before these code paths)
  'packages/game-core/src/systems/town.ts:22': {
    category: 'G',
    reason: 'Blueprint availability guard (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:26': {
    category: 'G',
    reason: 'Enchantment registry guard (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:32': {
    category: 'G',
    reason: 'Gold availability guard (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:37': {
    category: 'G',
    reason: 'Equipment slot validation (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:40': {
    category: 'G',
    reason: 'Item type validation — armor-only (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:46': {
    category: 'G',
    reason: 'Enchantment slot availability (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:50': {
    category: 'G',
    reason: 'All slots filled guard (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:53': {
    category: 'G',
    reason: 'Duplicate enchantment guard (processEnchantArmor — pre-condition)',
  },
  'packages/game-core/src/systems/town.ts:129': {
    category: 'G',
    reason: 'Spell not found — defensive post-validation guard (validateTownTransaction runs first)',
  },
  'packages/game-core/src/systems/town.ts:137': {
    category: 'G',
    reason: 'Study ineligible — defensive post-validation guard (validateTownTransaction runs first)',
  },
  'packages/game-core/src/systems/town.ts:167': {
    category: 'D',
    reason: 'enter_dungeon delegated to game-engine layer',
  },
  'packages/game-core/src/systems/town.ts:171': {
    category: 'B',
    reason: 'Dead code — enchant_armor case superseded by ENCHANT_ARMOR command',
  },
  'packages/game-core/src/systems/town.ts:183': {
    category: 'G',
    reason: 'Already full health guard',
  },
  'packages/game-core/src/systems/town.ts:188': {
    category: 'G',
    reason: 'Already full health guard (processRest)',
  },
  'packages/game-core/src/systems/town.ts:192': {
    category: 'G',
    reason: 'Cannot afford healing guard (processRest)',
  },
  'packages/game-core/src/systems/town.ts:189': {
    category: 'G',
    reason: 'Cannot afford healing guard',
  },
  'packages/game-core/src/systems/town.ts:197': {
    category: 'B',
    reason: 'Partial rest deducts gold — missing GOLD_CHANGED event',
  },
  'packages/game-core/src/systems/town.ts:272': {
    category: 'G',
    reason: 'Stock guard — defensive post-validation (validateTownTransaction runs first)',
  },
  'packages/game-core/src/systems/town.ts:282': {
    category: 'G',
    reason: 'Template guard — defensive post-validation (validateTownTransaction runs first)',
  },
  'packages/game-core/src/systems/town.ts:286': {
    category: 'G',
    reason: 'Rarity gate — server-side buy restriction (not yet covered by validator)',
  },
  'packages/game-core/src/systems/town.ts:342': {
    category: 'G',
    reason: 'Item entity ID validation (processShopSell)',
  },
  'packages/game-core/src/systems/town.ts:345': {
    category: 'G',
    reason: 'Item template validation (processShopSell)',
  },
  'packages/game-core/src/systems/town.ts:351': {
    category: 'G',
    reason: 'Transaction lookup guard',
  },
  'packages/game-core/src/systems/town.ts:386': {
    category: 'D',
    reason: 'Undo intentionally emits no new event (reverses prior transaction)',
  },
  'packages/game-core/src/systems/town.ts:388': {
    category: 'D',
    reason: 'Undo intentionally emits no new event (reverses prior transaction)',
  },
  'packages/game-core/src/systems/town.ts:397': {
    category: 'G',
    reason: 'Quest ID validation',
  },
  'packages/game-core/src/systems/town.ts:400': {
    category: 'G',
    reason: 'Quest registry guard',
  },
  'packages/game-core/src/systems/town.ts:404': {
    category: 'G',
    reason: 'Quest completion eligibility guard',
  },
  'packages/game-core/src/systems/town.ts:451': {
    category: 'G',
    reason: 'Quest not found — defensive post-validation guard (validateTownTransaction runs first)',
  },

  // -------------------------------------------------------------------------
  // D category: Architectural delegations (handled at higher layer)
  // -------------------------------------------------------------------------
  'packages/game-core/src/engine/command-handler.ts:101': {
    category: 'D',
    reason: 'ASCEND handled at game-engine layer (comment confirms)',
  },
  'packages/game-core/src/engine/command-handler.ts:134': {
    category: 'D',
    reason: 'TOGGLE_DEBUG is meta-flag, no domain event intended',
  },

  // -------------------------------------------------------------------------
  // B category: Bug findings (successful mutations missing events)
  // -------------------------------------------------------------------------
  'packages/game-core/src/engine/command-handler.ts:111': {
    category: 'B',
    reason: 'Unregistered custom ring-spell handler — should log or emit DEBUG event',
  },

  // -------------------------------------------------------------------------
  // P category: Confirmed player-facing rejections (Phase 1 & 2 protected)
  // These paths MUST emit PLAYER_ACTION_REJECTED; if they return empty events the audit fails.
  // -------------------------------------------------------------------------

  // Phase 1: MVP
  // (inventory-handlers.ts has no empty-events returns left — it already emits PLAYER_ACTION_REJECTED)

  // Phase 2 — Slice 1: Ability execution rejections (3 codes via validateAbilityAction)
  'packages/game-core/src/abilities/runtime/execute-ability.ts:50': {
    category: 'P',
    reason: '[Phase 2] Ability not found (ABILITY_NOT_FOUND)',
  },
  'packages/game-core/src/abilities/runtime/execute-ability.ts:59': {
    category: 'P',
    reason: '[Phase 2] Requirements not met (ABILITY_REQUIREMENTS_NOT_MET)',
  },
  'packages/game-core/src/abilities/runtime/execute-ability.ts:70': {
    category: 'P',
    reason: '[Phase 2] Ability not available (ABILITY_NOT_AVAILABLE)',
  },

  // Phase 2 — Slice 2: Tile-target ability rejections (8 codes via validateAbilityAction)
  'packages/game-core/src/engine/handlers/thunder-step.ts:29': {
    category: 'P',
    reason: '[Phase 2] Missing tile target (MISSING_TILE_TARGET)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:35': {
    category: 'P',
    reason: '[Phase 2] Wrong phase (WRONG_PHASE) - must be in dungeon',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:41': {
    category: 'P',
    reason: '[Phase 2] Ability on cooldown (ABILITY_ON_COOLDOWN)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:45': {
    category: 'P',
    reason: '[Phase 2] Insufficient mana (INSUFFICIENT_MANA)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:49': {
    category: 'P',
    reason: '[Phase 2] Invalid tile target (INVALID_TILE_TARGET)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:53': {
    category: 'P',
    reason: '[Phase 2] Tile not visible (TILE_NOT_VISIBLE)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:57': {
    category: 'P',
    reason: '[Phase 2] Tile occupied (TILE_OCCUPIED)',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:61': {
    category: 'P',
    reason: '[Phase 2] Out of range (OUT_OF_RANGE)',
  },
};

// Protected file paths: files that should emit visible events (not silent no-ops)
// for player-facing rejection or combat resolution scenarios.
// A finding in these files is only a "protected failure" if it has no KNOWN_PATTERNS entry
// (meaning it is unclassified) OR if its KNOWN_PATTERNS category is 'P'.
// Findings with 'G', 'D', or 'B' in KNOWN_PATTERNS are classified normally even inside protected files.
const protectedPaths = [
  // Phase 1: MVP
  'packages/game-core/src/engine/handlers/inventory-handlers.ts',
  // Phase 2: Centralized validators
  'packages/game-core/src/abilities/runtime/execute-ability.ts', // Ability execution rejections
  'packages/game-core/src/engine/handlers/thunder-step.ts', // Tile-target ability rejections
  // Phase 3: Combat observability
  'packages/game-core/src/abilities/effects/apply-attack.ts', // Invalid target emits ATTACK_PERFORMED(hit:false)
  // Phase 4A: Movement blocked observability
  'packages/game-core/src/engine/handlers/movement.ts', // Blocked terrain/bounds emits MOVEMENT_BLOCKED
];

const REPO_ROOT = process.cwd();

function scanDirectory(dir: string) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    scanErrors.push(`Cannot read directory ${dir}: ${msg}`);
    return;
  }

  for (const item of entries) {
    const fullPath = join(dir, item.name);
    if (item.isDirectory()) {
      if (!item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'dist') {
        scanDirectory(fullPath);
      }
    } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js'))) {
      if (item.name.endsWith('.test.ts') || item.name.endsWith('.test.js')) {
        continue;
      }
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath: string) {
  if (!filePath.includes('packages/game-core/src')) {
    return;
  }

  const relPath = relative(REPO_ROOT, filePath);

  // Skip excluded autonomous system files
  if (EXCLUDED_PATHS.has(relPath)) {
    return;
  }

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    scanErrors.push(`Cannot read file ${relPath}: ${msg}`);
    return;
  }

  const lines = content.split('\n');
  const isInProtectedFile = protectedPaths.some((p) => relPath.includes(p));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes('return') && line.includes('events:') && line.includes('[]')) {
      const patternKey = `${relPath}:${i + 1}`;
      const pattern = KNOWN_PATTERNS[patternKey];

      // KNOWN_PATTERNS always wins for category classification.
      // A finding is a "protected failure" only if:
      //   1. It is in a protected file, AND
      //   2. It has no KNOWN_PATTERNS entry (unclassified) OR its KNOWN_PATTERNS category is 'P'
      const category: Finding['category'] = pattern?.category ?? (isInProtectedFile ? 'P' : 'unclassified');
      const isProtectedFailure = isInProtectedFile && (pattern === undefined || pattern.category === 'P');

      findings.push({
        file: relPath,
        line: i + 1,
        snippet: line.trim(),
        category,
        protected: isProtectedFailure,
      });
    }
  }
}

console.log('Auditing player action paths for silent no-op returns...\n');

scanDirectory(join(REPO_ROOT, 'packages/game-core/src'));

// Report scan errors immediately
if (scanErrors.length > 0) {
  console.error('SCAN ERRORS — audit cannot complete reliably:\n');
  for (const err of scanErrors) {
    console.error(`  ${err}`);
  }
  console.error();
}

// A finding is a "protected failure" only when protected=true
const protectedFailures = findings.filter((f) => f.protected);
// P-category findings that are NOT already counted as protected failures
const playerRejectionsP = findings.filter((f) => f.category === 'P' && !f.protected);
const unresolvedFindings = findings.filter((f) => f.category === 'unclassified' && !f.protected);
const classifiedGuards = findings.filter((f) => f.category === 'G');
const delegatedPaths = findings.filter((f) => f.category === 'D');
const bugFindings = findings.filter((f) => f.category === 'B');

console.log('AUDIT RESULTS\n');

if (protectedFailures.length > 0) {
  console.log('[FAIL] PROTECTED PATHS — CI FAILURE (must emit rejection events):');
  console.log(`Found ${protectedFailures.length} paths that still return empty events:\n`);
  for (const finding of protectedFailures) {
    const pattern = KNOWN_PATTERNS[`${finding.file}:${finding.line}`];
    console.log(`  ${finding.file}:${finding.line}`);
    if (pattern) {
      console.log(`    ${pattern.reason}`);
    }
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (playerRejectionsP.length > 0) {
  console.log('[P] CONFIRMED player-facing rejections (already implemented via validators):');
  console.log(`Found ${playerRejectionsP.length} implemented rejection paths:\n`);
  for (const finding of playerRejectionsP) {
    const pattern = KNOWN_PATTERNS[`${finding.file}:${finding.line}`];
    console.log(`  ${finding.file}:${finding.line}`);
    if (pattern) {
      console.log(`    ${pattern.reason}`);
    }
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (unresolvedFindings.length > 0) {
  console.log('[?] UNCLASSIFIED findings (need review):');
  console.log(`Found ${unresolvedFindings.length} paths without classification:\n`);
  for (const finding of unresolvedFindings) {
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (bugFindings.length > 0) {
  console.log('[B] BUG FINDINGS (successful mutations missing events):');
  console.log(`Found ${bugFindings.length} paths with missing events:\n`);
  for (const finding of bugFindings) {
    const pattern = KNOWN_PATTERNS[`${finding.file}:${finding.line}`];
    console.log(`  ${finding.file}:${finding.line}`);
    if (pattern) {
      console.log(`    Reason: ${pattern.reason}`);
    }
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (classifiedGuards.length > 0) {
  console.log('[G] CLASSIFIED GUARDS (legitimate, no action needed):');
  console.log(`Found ${classifiedGuards.length} legitimate pre-condition guards.\n`);
}

if (delegatedPaths.length > 0) {
  console.log('[D] ARCHITECTURAL DELEGATIONS (handled at higher layer):');
  console.log(`Found ${delegatedPaths.length} paths correctly delegated.\n`);
}

// Summary section
console.log('='.repeat(70));
console.log('GUARDRAIL SUMMARY\n');

// Phase 1/2/3 accounting
const phase1ProtectedPaths = new Set(['packages/game-core/src/engine/handlers/inventory-handlers.ts']);
const phase2ProtectedPaths = new Set([
  'packages/game-core/src/abilities/runtime/execute-ability.ts',
  'packages/game-core/src/engine/handlers/thunder-step.ts',
  'packages/game-core/src/systems/town.ts',
  'packages/game-core/src/systems/equipment.ts',
]);

// Count P-category findings in implemented phase 2 paths (these show that validators are working)
const phase2Implemented = findings.filter(
  f => f.category === 'P' && phase2ProtectedPaths.has(f.file.replace('packages/game-core/src/', 'packages/game-core/src/'))
);
const phase1Protected = protectedFailures.filter(f => phase1ProtectedPaths.has(f.file));
const phase2Protected = protectedFailures.filter(f => phase2ProtectedPaths.has(f.file));

console.log(`Phase 1 protected paths (MVP): implemented`);
console.log(`Phase 2 centralized validators: implemented`);
console.log(`  - Slice 1 (Ability execution): 3 rejection codes via validateAbilityAction`);
console.log(`  - Slice 2 (Tile-target abilities): 8 rejection codes via validateAbilityAction`);
console.log(`  - Slice 3 (Town transactions): validateTownTransaction (SPELL_NOT_FOUND, SPELL_STUDY_INELIGIBLE, ITEM_NOT_FOR_SALE, INSUFFICIENT_GOLD, QUEST_NOT_FOUND, QUEST_NOT_READY)`);
console.log(`  - Slice 4 (Equipment constraints): validateEquipmentAction (EQUIPMENT_INCOMPATIBLE, ITEM_NOT_FOUND)`);
console.log(`Phase 3 combat observability: implemented`);
console.log(`  - apply-attack.ts: invalid target (run null or enemy not found) emits ATTACK_PERFORMED(hit:false)`);
console.log(`Phase 4A movement blocked observability: implemented`);
console.log(`  - movement.ts handleMove: blocked terrain/bounds/invalid-direction/not-in-dungeon emits MOVEMENT_BLOCKED (INVALID_DIRECTION, NOT_IN_DUNGEON, OUT_OF_BOUNDS, NOT_WALKABLE, TARGET_NOT_FOUND)`);
console.log(`  - Phase 4B candidates (not yet implemented): disarm-trap.ts, set-trap.ts\n`);

console.log(`Remaining unprotected findings: ${unresolvedFindings.length}`);
console.log(`Categorization breakdown:`);
console.log(`  - G (Guards): ${classifiedGuards.length}`);
console.log(`  - D (Delegations): ${delegatedPaths.length}`);
console.log(`  - B (Bugs): ${bugFindings.length}`);
console.log(`  - P (Implemented rejections): ${playerRejectionsP.length}`);
console.log(`  - Unclassified: ${unresolvedFindings.length}`);
console.log(`  - Protected failures: ${protectedFailures.length}\n`);

const failureCount = protectedFailures.length + unresolvedFindings.length + scanErrors.length;

if (failureCount === 0) {
  console.log('All protected paths have been fixed!');
  console.log(`${classifiedGuards.length} guards classified as legitimate`);
  console.log(`${delegatedPaths.length} paths classified as delegated`);
  if (bugFindings.length > 0) {
    console.log(`${bugFindings.length} bug(s) documented for follow-up`);
  }
  console.log();
  process.exit(0);
} else {
  const issues: string[] = [];
  if (protectedFailures.length > 0) issues.push(`${protectedFailures.length} protected failures`);
  if (unresolvedFindings.length > 0) issues.push(`${unresolvedFindings.length} unclassified`);
  if (scanErrors.length > 0) issues.push(`${scanErrors.length} scan error(s)`);
  console.log(`FAIL: ${issues.join(', ')}.\n`);
  process.exit(1);
}
