/**
 * Audit script to find potential silent no-op returns in player action paths.
 *
 * Scans game-core source files for patterns like `return { state, events: [], runEnded: false }`
 * and reports them for review.
 *
 * Some patterns are protected in this MVP (marked as failures).
 * Others are reported as informational findings for future triage.
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

// Classified patterns (G, D, B categories) mapped by file:line
const KNOWN_PATTERNS: Record<string, PatternInfo> = {
  // G category: Legitimate pre-condition guards
  'packages/game-core/src/abilities/effects/apply-attack.ts:22': {
    category: 'G',
    reason: 'Heat surge passive not active — legitimate no-op',
  },
  'packages/game-core/src/abilities/effects/apply-attack.ts:55': {
    category: 'G',
    reason: 'Target already dead or run null — legitimate no-op',
  },
  'packages/game-core/src/abilities/effects/apply-attack.ts:61': {
    category: 'G',
    reason: 'Target lookup failed — legitimate defensive guard',
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
  'packages/game-core/src/engine/handlers/movement.ts:39': {
    category: 'G',
    reason: 'Bounds validation',
  },
  'packages/game-core/src/engine/handlers/movement.ts:42': {
    category: 'G',
    reason: 'Obstacle detection',
  },
  'packages/game-core/src/engine/handlers/movement.ts:161': {
    category: 'G',
    reason: 'Run state guard',
  },
  'packages/game-core/src/engine/handlers/movement.ts:165': {
    category: 'G',
    reason: 'Object registry lookup',
  },
  'packages/game-core/src/engine/handlers/movement.ts:168': {
    category: 'G',
    reason: 'Template registry lookup',
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
  'packages/game-core/src/engine/handlers/town-handlers.ts:14': {
    category: 'G',
    reason: 'Phase guard (town-only)',
  },
  'packages/game-core/src/systems/equipment.ts:245': {
    category: 'G',
    reason: 'No new unlocks — legitimate no-op',
  },
  'packages/game-core/src/systems/equipment.ts:271': {
    category: 'G',
    reason: 'Item registry guard — defensive',
  },
  'packages/game-core/src/systems/equipment.ts:272': {
    category: 'G',
    reason: 'Trap item constraint — legitimate guard',
  },
  'packages/game-core/src/systems/inventory.ts:108': {
    category: 'G',
    reason: 'Item availability guard',
  },

  // D category: Architectural delegations
  'packages/game-core/src/engine/command-handler.ts:101': {
    category: 'D',
    reason: 'ASCEND handled at game-engine layer (comment confirms)',
  },
  'packages/game-core/src/engine/command-handler.ts:111': {
    category: 'B',
    reason: 'Unregistered custom ring-spell handler — should log or emit DEBUG event',
  },
  'packages/game-core/src/engine/command-handler.ts:134': {
    category: 'D',
    reason: 'TOGGLE_DEBUG is meta-flag, no domain event intended',
  },
  'packages/game-core/src/systems/town.ts:21': {
    category: 'G',
    reason: 'Blueprint availability guard',
  },
  'packages/game-core/src/systems/town.ts:25': {
    category: 'G',
    reason: 'Enchantment registry guard',
  },
  'packages/game-core/src/systems/town.ts:30': {
    category: 'G',
    reason: 'Gold availability guard',
  },
  'packages/game-core/src/systems/town.ts:36': {
    category: 'G',
    reason: 'Equipment slot validation',
  },
  'packages/game-core/src/systems/town.ts:39': {
    category: 'G',
    reason: 'Item type validation (armor-only)',
  },
  'packages/game-core/src/systems/town.ts:45': {
    category: 'G',
    reason: 'Enchantment slot availability',
  },
  'packages/game-core/src/systems/town.ts:49': {
    category: 'G',
    reason: 'All slots filled guard',
  },
  'packages/game-core/src/systems/town.ts:52': {
    category: 'G',
    reason: 'Duplicate enchantment guard',
  },
  'packages/game-core/src/systems/town.ts:107': {
    category: 'G',
    reason: 'Spell ID validation',
  },
  'packages/game-core/src/systems/town.ts:110': {
    category: 'G',
    reason: 'Spell registry guard',
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
  'packages/game-core/src/systems/town.ts:189': {
    category: 'G',
    reason: 'Cannot afford healing guard',
  },
  'packages/game-core/src/systems/town.ts:232': {
    category: 'G',
    reason: 'Item ID validation',
  },
  'packages/game-core/src/systems/town.ts:235': {
    category: 'G',
    reason: 'Stock availability guard',
  },
  'packages/game-core/src/systems/town.ts:244': {
    category: 'G',
    reason: 'Gold availability guard',
  },
  'packages/game-core/src/systems/town.ts:247': {
    category: 'G',
    reason: 'Item registry guard',
  },
  'packages/game-core/src/systems/town.ts:251': {
    category: 'B',
    reason: 'Shop purchase success — missing GOLD_CHANGED event',
  },
  'packages/game-core/src/systems/town.ts:307': {
    category: 'G',
    reason: 'Item entity ID validation',
  },
  'packages/game-core/src/systems/town.ts:310': {
    category: 'G',
    reason: 'Item template validation',
  },
  'packages/game-core/src/systems/town.ts:343': {
    category: 'B',
    reason: 'Shop sell success — missing GOLD_CHANGED event',
  },
  'packages/game-core/src/systems/town.ts:351': {
    category: 'G',
    reason: 'Transaction lookup guard',
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

  // P category: Confirmed player-facing rejections with failing tests
  'packages/game-core/src/engine/handlers/thunder-step.ts:51': {
    category: 'P',
    reason: 'Ability on cooldown — needs ABILITY_ON_COOLDOWN event',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:55': {
    category: 'P',
    reason: 'Insufficient mana — needs INSUFFICIENT_MANA event',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:63': {
    category: 'P',
    reason: 'Target tile not walkable — needs INVALID_TILE_TARGET event',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:66': {
    category: 'P',
    reason: 'Target tile not visible — needs INVALID_TILE_TARGET event',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:71': {
    category: 'P',
    reason: 'Teleporting to own tile — needs INVALID_TILE_TARGET event',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:77': {
    category: 'P',
    reason: 'Target tile occupied — needs TILE_OCCUPIED event',
  },
  'packages/game-core/src/engine/handlers/thunder-step.ts:85': {
    category: 'P',
    reason: 'Out of range — needs OUT_OF_RANGE event',
  },
  'packages/game-core/src/abilities/runtime/execute-ability.ts:63': {
    category: 'P',
    reason: 'Requirements not met — needs ABILITY_REQUIREMENTS_NOT_MET event',
  },
  'packages/game-core/src/systems/town.ts:116': {
    category: 'P',
    reason: 'Ineligible to study spell — needs SPELL_STUDY_INELIGIBLE event',
  },

  // Unclassified in initial scan but need review
  'packages/game-core/src/engine/command-handler.ts:117': {
    category: 'G',
    reason: 'Phase guard (enchant armor only in town)',
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
  'packages/game-core/src/systems/town.ts:31': {
    category: 'G',
    reason: 'No affordable healing (internal guard)',
  },
  'packages/game-core/src/systems/town.ts:197': {
    category: 'B',
    reason: 'Partial rest deducts gold — missing GOLD_CHANGED event',
  },
};

const protectedPaths = [
  'packages/game-core/src/engine/handlers/inventory-handlers.ts',
  'packages/game-core/src/systems/town.ts', // Town transaction rejection guardrails
];

const REPO_ROOT = process.cwd();

function scanDirectory(dir: string) {
  const items = readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
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

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes('return') && line.includes('events:') && line.includes('[]')) {
        const isProtected = protectedPaths.some((p) => relPath.includes(p));
        const patternKey = `${relPath}:${i + 1}`;
        const pattern = KNOWN_PATTERNS[patternKey];
        const category: Finding['category'] = isProtected ? 'P' : pattern?.category ?? 'unclassified';

        findings.push({
          file: relPath,
          line: i + 1,
          snippet: line.trim(),
          category,
          protected: isProtected,
        });
      }
    }
  } catch {
  }
}

console.log('Auditing player action paths for silent no-op returns...\n');

scanDirectory(join(REPO_ROOT, 'packages/game-core/src'));

const protectedFindings = findings.filter((f) => f.protected);
const playerRejectionsP = findings.filter((f) => f.category === 'P');
const unresolvedFindings = findings.filter((f) => f.category === 'unclassified' && !f.protected);
const classifiedGuards = findings.filter((f) => f.category === 'G');
const delegatedPaths = findings.filter((f) => f.category === 'D');
const bugFindings = findings.filter((f) => f.category === 'B');

console.log('AUDIT RESULTS\n');

if (protectedFindings.length > 0) {
  console.log('[P] PROTECTED PATHS (MVP scope) — CI FAILURE:');
  console.log(`Found ${protectedFindings.length} paths that must emit rejection events:\n`);
  for (const finding of protectedFindings) {
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`    ${finding.snippet}`);
  }
  console.log();
}

if (playerRejectionsP.length > 0) {
  console.log('[P] CONFIRMED player-facing rejections (failing tests added):');
  console.log(`Found ${playerRejectionsP.length} paths awaiting implementation:\n`);
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

const failureCount = protectedFindings.length + unresolvedFindings.length;

if (failureCount === 0 && playerRejectionsP.length === 0) {
  console.log('✓ All protected paths have been fixed!');
  console.log(`✓ ${playerRejectionsP.length} player-facing rejections implemented`);
  console.log(`✓ ${classifiedGuards.length} guards classified as legitimate`);
  console.log(`✓ ${delegatedPaths.length} paths classified as delegated`);
  if (bugFindings.length > 0) {
    console.log(`✓ ${bugFindings.length} bug(s) documented for follow-up\n`);
  } else {
    console.log();
  }
  process.exit(0);
} else {
  const totalIssues = failureCount + playerRejectionsP.length;
  console.log(
    `✗ ${totalIssues} issue(s): ${protectedFindings.length} protected, ${playerRejectionsP.length} P-category awaiting implementation, ${unresolvedFindings.length} unclassified.\n`
  );
  process.exit(1);
}
