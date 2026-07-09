#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
  collectRequiredProofPatterns,
  findFeaturesForPath,
  parseFeatureProofRegistry,
} from './guardrails/feature-proof-registry.mjs';
import { isCliMain, normalizePath, parseArgs } from './guardrails/common.mjs';

const DEFAULT_BASE_REF = process.env.FEATURE_PROOF_BASE ?? 'main';

const PROOF_CATEGORIES = {
  'contract-or-integration': {
    label: 'contract or integration proof',
    description: 'Add or update a contract or integration test for command, schema, or event behavior.',
    suggestedHomes: [
      'tests/contracts/*.contract.test.ts',
      'tests/integration/*.integration.test.ts',
    ],
    matches: (path) =>
      path.startsWith('tests/contracts/')
      || path.startsWith('tests/integration/')
      || path.includes('.contract.test.')
      || path.includes('.integration.test.'),
  },
  'core-runtime': {
    label: 'core gameplay runtime proof',
    description: 'Add or update a unit, property, or integration test for the changed core behavior.',
    suggestedHomes: [
      'packages/game-core/src/**/*.test.ts',
      'packages/game-core/src/**/*.property.test.ts',
      'tests/integration/*.integration.test.ts',
    ],
    matches: (path) =>
      (path.startsWith('packages/game-core/src/') && isTestPath(path))
      || path.startsWith('tests/integration/'),
  },
  'feature-chain': {
    label: 'player-visible feature-chain proof',
    description: 'Prove the state/event/presenter chain for player-visible gameplay.',
    suggestedHomes: [
      'tests/integration/*.integration.test.ts',
      'packages/presenter/src/game-view-builder.test.ts',
      'packages/presenter/src/event-formatter.test.ts',
      'apps/web/src/components/*.test.tsx',
      'tests/e2e/*.spec.ts',
    ],
    matches: (path) =>
      path.startsWith('tests/integration/')
      || path.startsWith('packages/presenter/src/')
      || path.startsWith('apps/web/src/components/')
      || path.startsWith('tests/e2e/'),
  },
  presenter: {
    label: 'presenter proof',
    description: 'Add or update a presenter test showing GameState is exposed as the expected GameView.',
    suggestedHomes: [
      'packages/presenter/src/**/*.test.ts',
      'packages/presenter/src/**/*.test.tsx',
    ],
    matches: (path) => path.startsWith('packages/presenter/src/') && isTestPath(path),
  },
  'web-ui': {
    label: 'web UI proof',
    description: 'Add or update a component test or E2E proof for the changed browser behavior.',
    suggestedHomes: [
      'apps/web/src/components/*.test.tsx',
      'apps/web/src/**/*.test.tsx',
      'tests/e2e/*.spec.ts',
    ],
    matches: (path) =>
      (path.startsWith('apps/web/src/') && isTestPath(path))
      || path.startsWith('tests/e2e/'),
  },
  'content-id': {
    label: 'content ID contract proof',
    description: 'Add or update contract coverage for live content IDs and cross-references.',
    suggestedHomes: [
      'tests/contracts/content-cross-references.contract.test.ts',
      'tests/contracts/*coverage.contract.test.ts',
    ],
    matches: (path) => path.startsWith('tests/contracts/'),
  },
  'ability-contract': {
    label: 'ability contract and runtime proof',
    description: 'Add or update ability contract coverage plus runtime or integration proof.',
    suggestedHomes: [
      'scripts/check-ability-contracts.ts',
      'tests/contracts/ability-contracts.contract.test.ts',
      'tests/contracts/ability-runtime-coverage.contract.test.ts',
      'packages/game-core/src/engine/abilities-coverage.integration.test.ts',
      'tests/integration/*.integration.test.ts',
    ],
    matches: (path) =>
      path === 'scripts/check-ability-contracts.ts'
      || (path.startsWith('tests/contracts/') && path.includes('abilit'))
      || (path.startsWith('packages/game-core/src/') && path.includes('abilit') && isTestPath(path))
      || path.startsWith('tests/integration/'),
  },
  animation: {
    label: 'animation coverage proof',
    description: 'Add or update animation coverage, renderer, component, or browser proof.',
    suggestedHomes: [
      'pnpm run check:three-animations',
      'tests/contracts/three-animation-coverage.contract.test.ts',
      'apps/web/src/rendering/**/*.test.ts',
      'apps/web/src/components/*.test.tsx',
      'tests/e2e/*animation*.spec.ts',
    ],
    matches: (path) =>
      path === 'scripts/guardrails/check-three-animation-coverage.ts'
      || path.includes('three-animation-coverage.contract.test.ts')
      || (path.startsWith('apps/web/src/rendering/') && isTestPath(path))
      || (path.startsWith('apps/web/src/animation') && isTestPath(path))
      || (path.startsWith('apps/web/src/components/') && isTestPath(path))
      || (path.startsWith('tests/e2e/') && path.includes('animation')),
  },
  persistence: {
    label: 'save compatibility or migration proof',
    description: 'Add or update save snapshot, migration, restore, or historical fixture coverage.',
    suggestedHomes: [
      'packages/game-core/src/state/save-snapshot.test.ts',
      'packages/game-core/src/state/save-compatibility.test.ts',
      'tests/contracts/save-snapshot-scenario.contract.test.ts',
      'fixtures/saves/**',
    ],
    matches: (path) =>
      path === 'packages/game-core/src/state/save-snapshot.test.ts'
      || path === 'packages/game-core/src/state/save-compatibility.test.ts'
      || path === 'tests/contracts/save-snapshot-scenario.contract.test.ts'
      || path.startsWith('fixtures/saves/'),
  },
  'browser-proof': {
    label: 'browser-facing proof',
    description: 'Add or update a component test or scenario E2E proof, or add a browser allowlist reason.',
    suggestedHomes: [
      'apps/web/src/components/*.test.tsx',
      'apps/web/src/**/*.test.tsx',
      'tests/e2e/*.spec.ts',
      'Validation command: pnpm test:e2e:scenario',
    ],
    matches: (path) =>
      (path.startsWith('apps/web/src/') && isTestPath(path))
      || path.startsWith('tests/e2e/'),
  },
};

function runGit(repoRoot, args, options = {}) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    if (options.allowFailure === true) {
      return '';
    }
    throw new Error((result.stderr || result.stdout || '').trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function splitGitPaths(output) {
  return output
    .split('\n')
    .map((path) => normalizePath(path.trim()))
    .filter(Boolean);
}

function resolveBaseRef(repoRoot, baseRef) {
  const fallbackRef = `origin/${baseRef}`;

  for (const candidateRef of [baseRef, fallbackRef]) {
    const resolved = runGit(repoRoot, ['rev-parse', '--verify', '--quiet', candidateRef], {
      allowFailure: true,
    }).trim();

    if (resolved) {
      return candidateRef;
    }
  }

  throw new Error(
    `Unable to resolve feature proof base ref "${baseRef}" or "${fallbackRef}". Fetch the base branch before running this guardrail.`,
  );
}

export function listChangedPaths(repoRoot, baseRef = DEFAULT_BASE_REF) {
  const resolvedBaseRef = resolveBaseRef(repoRoot, baseRef);
  const pathSets = [
    splitGitPaths(
      runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR', `${resolvedBaseRef}...HEAD`]),
    ),
    splitGitPaths(runGit(repoRoot, ['diff', '--name-only', '--diff-filter=ACMR'])),
    splitGitPaths(runGit(repoRoot, ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])),
    splitGitPaths(runGit(repoRoot, ['ls-files', '--others', '--exclude-standard'])),
  ];

  return [...new Set(pathSets.flat())]
    .filter((relativePath) => existsSync(join(repoRoot, relativePath)))
    .sort();
}

function isTestPath(relativePath) {
  return (
    relativePath.endsWith('.test.ts')
    || relativePath.endsWith('.test.tsx')
    || relativePath.endsWith('.property.test.ts')
    || relativePath.endsWith('.property.test.tsx')
    || relativePath.endsWith('.integration.test.ts')
    || relativePath.endsWith('.contract.test.ts')
    || relativePath.endsWith('.balance.test.ts')
    || relativePath.endsWith('.spec.ts')
    || relativePath.endsWith('.spec.tsx')
    || (relativePath.startsWith('tests/') && (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')))
  );
}

function isProofPath(relativePath) {
  return (
    isTestPath(relativePath)
    || relativePath.startsWith('fixtures/saves/')
    || relativePath === 'scripts/check-ability-contracts.ts'
    || relativePath === 'scripts/guardrails/check-three-animation-coverage.ts'
  );
}

function matchesPrefix(relativePath, prefixes) {
  return prefixes.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix));
}

function addSurface(surfaces, surface) {
  if (!surfaces.some((existing) => existing.id === surface.id)) {
    surfaces.push(surface);
  }
}

function classifyProductionPath(relativePath) {
  if (isTestPath(relativePath)) return [];
  if (
    relativePath.startsWith('docs/')
    || relativePath.startsWith('scripts/')
    || relativePath.startsWith('.github/')
    || relativePath.startsWith('.agents/')
    || relativePath.startsWith('.claude/')
    || relativePath.startsWith('.codex/')
    || relativePath.startsWith('fixtures/saves/')
    || relativePath === 'package.json'
    || relativePath === 'pnpm-lock.yaml'
  ) {
    return [];
  }

  const surfaces = [];

  if (matchesPrefix(relativePath, [
    'packages/game-contracts/src/commands/',
    'packages/game-contracts/src/schemas/',
  ])) {
    addSurface(surfaces, {
      id: 'command-schema',
      label: 'command/schema surface',
      categories: ['contract-or-integration', 'browser-proof'],
    });
  }

  if (
    matchesPrefix(relativePath, ['packages/game-contracts/src/events/'])
    || relativePath === 'packages/presenter/src/event-formatter.ts'
  ) {
    addSurface(surfaces, {
      id: 'event',
      label: 'event surface',
      categories: ['contract-or-integration', 'feature-chain', 'browser-proof'],
    });
  }

  if (matchesPrefix(relativePath, [
    'packages/game-core/src/engine/',
    'packages/game-core/src/systems/',
    'packages/game-core/src/abilities/',
    'packages/game-core/src/generation/',
    'packages/game-core/src/state/',
  ])) {
    addSurface(surfaces, {
      id: 'core-gameplay',
      label: 'core gameplay surface',
      categories: ['core-runtime', 'feature-chain'],
    });
  }

  if (
    relativePath === 'packages/game-core/src/engine/command-handler.ts'
    || relativePath === 'packages/game-core/src/engine/game-engine.ts'
  ) {
    addSurface(surfaces, {
      id: 'browser-facing-core',
      label: 'browser-facing command runtime',
      categories: ['browser-proof'],
    });
  }

  if (
    relativePath === 'packages/presenter/src/game-view.ts'
    || relativePath === 'packages/presenter/src/game-view-builder.ts'
    || relativePath.startsWith('packages/presenter/src/builders/')
    || relativePath.startsWith('packages/presenter/src/')
  ) {
    addSurface(surfaces, {
      id: 'presenter',
      label: 'presenter read-model surface',
      categories: ['presenter', 'browser-proof'],
    });
  }

  if (matchesPrefix(relativePath, [
    'apps/web/src/components/',
    'apps/web/src/hooks/',
    'apps/web/src/animation-runtime/',
    'apps/web/src/rendering/',
    'apps/web/src/store/',
  ]) || relativePath === 'apps/web/src/App.tsx') {
    addSurface(surfaces, {
      id: 'web-ui',
      label: 'web UI surface',
      categories: ['web-ui', 'browser-proof'],
    });
  }

  if (relativePath.startsWith('packages/content/src/')) {
    addSurface(surfaces, {
      id: 'content',
      label: 'content surface',
      categories: ['content-id'],
    });
  }

  if (
    relativePath.includes('/abilities/')
    || relativePath.includes('/ring-spells/')
    || relativePath.includes('/ring-schools/')
  ) {
    addSurface(surfaces, {
      id: 'ability',
      label: 'ability or ring-spell surface',
      categories: ['ability-contract'],
    });
  }

  if (
    relativePath.includes('animation')
    || relativePath.startsWith('apps/web/src/rendering/three/')
  ) {
    addSurface(surfaces, {
      id: 'animation',
      label: 'animation/rendering surface',
      categories: ['animation', 'browser-proof'],
    });
  }

  if (
    /save|restore|game-state|persistedFloorCache|floor-cache|floor-transition|serialization|itemRegistry|item-registry/u.test(relativePath)
    || relativePath === 'packages/game-contracts/src/types/save-snapshot.ts'
  ) {
    addSurface(surfaces, {
      id: 'persistence',
      label: 'persistence/save-shape surface',
      categories: ['persistence'],
    });
  }

  return surfaces;
}

function readSource(rootDir, relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function getFeatureProofAllowlist(rootDir, relativePath) {
  const source = readSource(rootDir, relativePath);
  const valid = [];
  const invalid = [];
  const validPattern = /feature-proof:\s*(allow-refactor-only|allow-browser-not-required)\s+-\s*(\S[^\n\r]*)/giu;
  const anyPattern = /feature-proof:\s*(allow-refactor-only|allow-browser-not-required)\b[^\n\r]*/giu;

  for (const match of source.matchAll(validPattern)) {
    valid.push({
      kind: match[1],
      reason: match[2].trim(),
    });
  }

  for (const match of source.matchAll(anyPattern)) {
    const matchedText = match[0];
    if (/feature-proof:\s*(allow-refactor-only|allow-browser-not-required)\s+-\s*\S/iu.test(matchedText) === false) {
      invalid.push(matchedText.trim());
    }
  }

  return { valid, invalid };
}

function hasAllowlist(allowlist, kind) {
  return allowlist.valid.some((entry) => entry.kind === kind);
}

function changedProofMatchesCategory(changedProofPaths, categoryId) {
  const category = PROOF_CATEGORIES[categoryId];
  if (category === undefined) {
    return false;
  }
  return changedProofPaths.some((relativePath) => category.matches(relativePath));
}

function uniqueCategories(surfaces) {
  return [...new Set(surfaces.flatMap((surface) => surface.categories))];
}

function formatRegistryFeature(feature) {
  const proofs = collectRequiredProofPatterns(feature);
  return [
    `- ${feature.name} (${feature.feature})`,
    ...(proofs.length > 0
      ? proofs.slice(0, 6).map((proof) => `  required proof: ${proof}`)
      : ['  required proof: <none listed>']),
  ].join('\n');
}

function makeProofFailure({
  relativePath,
  surfaces,
  missingCategories,
  registryFeatures,
}) {
  const suggestedHomes = [
    ...new Set(
      missingCategories.flatMap((categoryId) => PROOF_CATEGORIES[categoryId]?.suggestedHomes ?? []),
    ),
  ];
  const requiredProof = missingCategories.map((categoryId) => {
    const category = PROOF_CATEGORIES[categoryId];
    return category === undefined
      ? `Add proof for ${categoryId}.`
      : `${category.label}: ${category.description}`;
  });

  return [
    'Production feature change requires proof.',
    '',
    'Changed production file:',
    relativePath,
    '',
    'Detected surface:',
    surfaces.map((surface) => surface.label).join(', '),
    '',
    'Required proof:',
    ...requiredProof.map((line) => `- ${line}`),
    '',
    'Suggested proof homes:',
    ...suggestedHomes.map((line) => `- ${line}`),
    ...(registryFeatures.length > 0
      ? [
          '',
          'Feature registry matches:',
          ...registryFeatures.map(formatRegistryFeature),
        ]
      : []),
  ].join('\n');
}

function collectBrowserIntentFailures(rootDir, changedPaths) {
  const failures = [];
  const changedE2eSpecs = changedPaths.filter((path) =>
    path.startsWith('tests/e2e/') && (path.endsWith('.spec.ts') || path.endsWith('.spec.tsx')),
  );
  const changedE2eSupport = changedPaths.filter((path) =>
    path.startsWith('tests/e2e/support/') && (path.endsWith('.ts') || path.endsWith('.tsx')),
  );
  const changedScenarioFixtures = changedPaths.filter((path) =>
    path.startsWith('fixtures/scenarios/') && path.endsWith('.json'),
  );
  const externalIntent = process.env.FEATURE_PROOF_TEST_INTENT ?? '';

  for (const relativePath of changedE2eSpecs) {
    const firstLines = readSource(rootDir, relativePath).split('\n').slice(0, 30).join('\n');
    if (/pnpm\s+test:e2e\b/u.test(firstLines) === false) {
      failures.push([
        'E2E proof changes must name the focused Playwright command.',
        '',
        'Changed E2E file:',
        relativePath,
        '',
        'Required proof:',
        'Add a test intent header Validation line that starts with pnpm test:e2e, such as pnpm test:e2e:scenario.',
      ].join('\n'));
    }
  }

  for (const relativePath of changedE2eSupport) {
    const firstLines = readSource(rootDir, relativePath).split('\n').slice(0, 30).join('\n');
    if (
      /pnpm\s+test:e2e\b/u.test(firstLines) === false
      && externalIntent.includes('pnpm test:e2e') === false
    ) {
      failures.push([
        'E2E support changes must name the focused Playwright command.',
        '',
        'Changed E2E support file:',
        relativePath,
        '',
        'Required proof:',
        'Record a pnpm test:e2e focused command in a nearby header/comment or FEATURE_PROOF_TEST_INTENT.',
      ].join('\n'));
    }
  }

  if (changedScenarioFixtures.length > 0) {
    const changedIntentSources = changedPaths.filter((path) =>
      path.endsWith('.md')
      || (path.startsWith('tests/e2e/') && (path.endsWith('.spec.ts') || path.endsWith('.spec.tsx'))),
    );
    const commandWasRecorded = externalIntent.includes('pnpm test:e2e:scenario')
      || changedIntentSources.some((path) => readSource(rootDir, path).includes('pnpm test:e2e:scenario'));

    if (commandWasRecorded === false) {
      failures.push([
        'Scenario fixture changes must record the focused browser proof command.',
        '',
        'Changed scenario fixture:',
        changedScenarioFixtures.join('\n'),
        '',
        'Required proof:',
        'Record pnpm test:e2e:scenario in an E2E test intent header, docs/checklist update, or FEATURE_PROOF_TEST_INTENT.',
      ].join('\n'));
    }
  }

  return failures;
}

export function checkFeatureProofs({
  rootDir = process.cwd(),
  baseRef = DEFAULT_BASE_REF,
  registryPath = DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
} = {}) {
  const absoluteRoot = resolve(rootDir);
  const changedPaths = listChangedPaths(absoluteRoot, baseRef);
  const changedProofPaths = changedPaths.filter(isProofPath);
  const registryAbsolutePath = join(absoluteRoot, registryPath);
  const registry = existsSync(registryAbsolutePath)
    ? parseFeatureProofRegistry(readFileSync(registryAbsolutePath, 'utf8'))
    : { features: [] };
  const failures = [];
  const allowlists = [];

  for (const relativePath of changedPaths) {
    const surfaces = classifyProductionPath(relativePath);
    if (surfaces.length === 0) {
      continue;
    }

    const allowlist = getFeatureProofAllowlist(absoluteRoot, relativePath);
    for (const invalidAllowlist of allowlist.invalid) {
      failures.push([
        'Feature proof allowlist requires a non-empty reason.',
        '',
        'Changed production file:',
        relativePath,
        '',
        'Found:',
        invalidAllowlist,
        '',
        'Required format:',
        'feature-proof: allow-refactor-only - reason',
        'feature-proof: allow-browser-not-required - reason',
      ].join('\n'));
    }
    if (allowlist.invalid.length > 0) {
      continue;
    }

    if (hasAllowlist(allowlist, 'allow-refactor-only')) {
      allowlists.push({ relativePath, allowlist: allowlist.valid });
      continue;
    }

    const categories = uniqueCategories(surfaces).filter((categoryId) =>
      categoryId === 'browser-proof'
        ? hasAllowlist(allowlist, 'allow-browser-not-required') === false
        : true,
    );
    if (hasAllowlist(allowlist, 'allow-browser-not-required')) {
      allowlists.push({ relativePath, allowlist: allowlist.valid });
    }

    const registryFeatures = findFeaturesForPath(registry, relativePath);
    const missingCategories = categories.filter((categoryId) =>
      changedProofMatchesCategory(changedProofPaths, categoryId) === false,
    );

    if (missingCategories.length > 0) {
      failures.push(makeProofFailure({
        relativePath,
        surfaces,
        missingCategories,
        registryFeatures,
      }));
    }
  }

  failures.push(...collectBrowserIntentFailures(absoluteRoot, changedPaths));

  return {
    changedPaths,
    changedProofPaths,
    failures,
    allowlists,
  };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const result = checkFeatureProofs({
    rootDir: typeof args.root === 'string' ? args.root : process.cwd(),
    baseRef: typeof args.base === 'string' ? args.base : DEFAULT_BASE_REF,
    registryPath: typeof args.registry === 'string'
      ? args.registry
      : DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
  });

  if (result.failures.length > 0) {
    console.error([
      'Feature proof guardrail failed.',
      `Checked ${result.changedPaths.length} changed file(s).`,
      '',
      ...result.failures,
    ].join('\n\n'));
    process.exit(1);
  }

  const allowlistLines = result.allowlists.flatMap(({ relativePath, allowlist }) =>
    allowlist.map((entry) => `- ${relativePath}: ${entry.kind} - ${entry.reason}`),
  );
  console.log([
    `Feature proof guardrail passed for ${result.changedPaths.length} changed file(s).`,
    ...(allowlistLines.length > 0
      ? ['Reported feature-proof allowlists:', ...allowlistLines]
      : []),
  ].join('\n'));
}

if (isCliMain(import.meta.url)) {
  try {
    run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error([
      'Blocked: feature proof guardrail could not run',
      '',
      'Found:',
      `  ${message}`,
      '',
      'Repair:',
      '  Fix scripts/check-feature-proofs.mjs or the local git checkout, then rerun pnpm run check:feature-proofs.',
    ].join('\n'));
    process.exit(1);
  }
}
