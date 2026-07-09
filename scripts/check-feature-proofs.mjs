#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
  collectProofPatterns,
  collectRequiredProofPatterns,
  findFeaturesForPath,
  matchesPathPattern,
  parseFeatureProofRegistry,
} from './guardrails/feature-proof-registry.mjs';
import { isBrowserFacingPath, isBrowserFacingWebUiPath } from './guardrails/browser-facing.mjs';
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
  return listChangedPathsForResolvedBase(repoRoot, resolvedBaseRef);
}

function listChangedPathsForResolvedBase(repoRoot, resolvedBaseRef) {
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

function listUntrackedPaths(repoRoot) {
  return new Set(splitGitPaths(runGit(repoRoot, ['ls-files', '--others', '--exclude-standard'])));
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

function uniqueSurfaces(surfaces) {
  return surfaces.filter((surface, index) =>
    surfaces.findIndex((candidate) => candidate.id === surface.id) === index,
  );
}

function optionalSurface(condition, surface) {
  return condition ? [surface] : [];
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
    || relativePath.startsWith('fixtures/')
    || relativePath === 'package.json'
    || relativePath === 'pnpm-lock.yaml'
  ) {
    return [];
  }

  return uniqueSurfaces([
    ...optionalSurface(matchesPrefix(relativePath, [
      'packages/game-contracts/src/commands/',
      'packages/game-contracts/src/schemas/',
    ]), {
      id: 'command-schema',
      label: 'command/schema surface',
      categories: ['contract-or-integration'],
    }),
    ...optionalSurface(
      matchesPrefix(relativePath, ['packages/game-contracts/src/events/'])
      || relativePath === 'packages/presenter/src/event-formatter.ts',
      {
        id: 'event',
        label: 'event surface',
        categories: ['contract-or-integration', 'feature-chain'],
      },
    ),
    ...optionalSurface(matchesPrefix(relativePath, [
      'packages/game-core/src/engine/',
      'packages/game-core/src/systems/',
      'packages/game-core/src/abilities/',
      'packages/game-core/src/generation/',
      'packages/game-core/src/state/',
    ]), {
      id: 'core-gameplay',
      label: 'core gameplay surface',
      categories: ['core-runtime', 'feature-chain'],
    }),
    ...optionalSurface(
      relativePath === 'packages/presenter/src/game-view.ts'
      || relativePath === 'packages/presenter/src/game-view-builder.ts'
      || relativePath.startsWith('packages/presenter/src/builders/')
      || relativePath.startsWith('packages/presenter/src/'),
      {
        id: 'presenter',
        label: 'presenter read-model surface',
        categories: ['presenter'],
      },
    ),
    ...optionalSurface(isBrowserFacingWebUiPath(relativePath), {
      id: 'web-ui',
      label: 'web UI surface',
      categories: ['web-ui'],
    }),
    ...optionalSurface(relativePath.startsWith('packages/content/src/'), {
      id: 'content',
      label: 'content surface',
      categories: ['content-id'],
    }),
    ...optionalSurface(
      relativePath.includes('/abilities/')
      || relativePath.includes('/ring-spells/')
      || relativePath.includes('/ring-schools/'),
      {
        id: 'ability',
        label: 'ability or ring-spell surface',
        categories: ['ability-contract'],
      },
    ),
    ...optionalSurface(
      relativePath.includes('animation')
      || relativePath.startsWith('apps/web/src/rendering/three/'),
      {
        id: 'animation',
        label: 'animation/rendering surface',
        categories: ['animation'],
      },
    ),
    ...optionalSurface(
      /save|restore|game-state|persistedFloorCache|floor-cache|floor-transition|serialization|itemRegistry|item-registry/u.test(relativePath)
      || relativePath === 'packages/game-contracts/src/types/save-snapshot.ts',
      {
        id: 'persistence',
        label: 'persistence/save-shape surface',
        categories: ['persistence'],
      },
    ),
    ...optionalSurface(isBrowserFacingPath(relativePath), {
      id: 'browser-facing',
      label: 'browser-facing surface',
      categories: ['browser-proof'],
    }),
  ]);
}

function readSource(rootDir, relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function extractAddedLines(diffOutput) {
  return diffOutput
    .split('\n')
    .filter((line) => line.startsWith('+') && line.startsWith('+++') === false)
    .map((line) => line.slice(1));
}

function getAddedLinesForPath(rootDir, resolvedBaseRef, relativePath, untrackedPaths) {
  if (untrackedPaths.has(relativePath)) {
    return readSource(rootDir, relativePath).split(/\r?\n/u);
  }

  return [
    runGit(rootDir, ['diff', '--unified=0', `${resolvedBaseRef}...HEAD`, '--', relativePath]),
    runGit(rootDir, ['diff', '--unified=0', '--', relativePath]),
    runGit(rootDir, ['diff', '--cached', '--unified=0', '--', relativePath]),
  ].flatMap(extractAddedLines);
}

function getFeatureProofAllowlist(addedLines) {
  const validPattern = /feature-proof:\s*(allow-refactor-only|allow-browser-not-required)\s+-\s*(\S[^\n\r]*)/iu;
  const anyPattern = /feature-proof:\s*(allow-refactor-only|allow-browser-not-required)\b[^\n\r]*/iu;

  return {
    valid: addedLines.flatMap((line) => {
      const match = line.match(validPattern);
      return match === null
        ? []
        : [{
            kind: match[1],
            reason: match[2].trim(),
          }];
    }),
    invalid: addedLines
      .filter((line) => anyPattern.test(line) && validPattern.test(line) === false)
      .map((line) => line.trim()),
  };
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
  const requiredProofs = collectRequiredProofPatterns(feature);
  const optionalProofs = collectProofPatterns(feature)
    .filter((proof) => requiredProofs.includes(proof) === false);
  return [
    `- ${feature.name} (${feature.feature})`,
    ...(requiredProofs.length > 0
      ? requiredProofs.slice(0, 6).map((proof) => `  required proof: ${proof}`)
      : ['  required proof: <none listed>']),
    ...(optionalProofs.length > 0
      ? optionalProofs.slice(0, 6).map((proof) => `  optional proof: ${proof}`)
      : []),
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

function changedProofMatchesRegistryFeature(changedProofPaths, feature) {
  const proofPatterns = collectProofPatterns(feature);
  return changedProofPaths.some((proofPath) =>
    proofPatterns.some((pattern) => matchesPathPattern(pattern, proofPath)),
  );
}

function makeRegistryProofFailure({
  relativePath,
  registryFeatures,
  changedProofPaths,
}) {
  return [
    'Registered feature proof requirement was not satisfied.',
    '',
    'Changed production file:',
    relativePath,
    '',
    'Required proof:',
    'At least one changed proof must match the registered feature required/optional proof patterns.',
    '',
    'Changed proofs:',
    ...(changedProofPaths.length > 0
      ? changedProofPaths.map((proofPath) => `- ${proofPath}`)
      : ['- <none>']),
    '',
    'Registered feature required/optional proofs were not among the changed proofs:',
    ...registryFeatures.map(formatRegistryFeature),
  ].join('\n');
}

function collectBrowserIntentFailures(rootDir, changedPaths) {
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

  const e2eSpecFailures = changedE2eSpecs.flatMap((relativePath) => {
    const firstLines = readSource(rootDir, relativePath).split('\n').slice(0, 30).join('\n');
    return /pnpm\s+test:e2e\b/u.test(firstLines) === false
      ? [[
        'E2E proof changes must name the focused Playwright command.',
        '',
        'Changed E2E file:',
        relativePath,
        '',
        'Required proof:',
        'Add a test intent header Validation line that starts with pnpm test:e2e, such as pnpm test:e2e:scenario.',
      ].join('\n')]
      : [];
  });

  const e2eSupportFailures = changedE2eSupport.flatMap((relativePath) => {
    const firstLines = readSource(rootDir, relativePath).split('\n').slice(0, 30).join('\n');
    return (
      /pnpm\s+test:e2e\b/u.test(firstLines) === false
      && externalIntent.includes('pnpm test:e2e') === false
    )
      ? [[
        'E2E support changes must name the focused Playwright command.',
        '',
        'Changed E2E support file:',
        relativePath,
        '',
        'Required proof:',
        'Record a pnpm test:e2e focused command in a nearby header/comment or FEATURE_PROOF_TEST_INTENT.',
      ].join('\n')]
      : [];
  });

  const changedIntentSources = changedPaths.filter((path) =>
    path.endsWith('.md')
    || (path.startsWith('tests/e2e/') && (path.endsWith('.spec.ts') || path.endsWith('.spec.tsx'))),
  );
  const commandWasRecorded = externalIntent.includes('pnpm test:e2e:scenario')
    || changedIntentSources.some((path) => readSource(rootDir, path).includes('pnpm test:e2e:scenario'));
  const scenarioFixtureFailures = changedScenarioFixtures.length > 0 && commandWasRecorded === false
    ? [[
        'Scenario fixture changes must record the focused browser proof command.',
        '',
        'Changed scenario fixture:',
        changedScenarioFixtures.join('\n'),
        '',
        'Required proof:',
        'Record pnpm test:e2e:scenario in an E2E test intent header, docs/checklist update, or FEATURE_PROOF_TEST_INTENT.',
      ].join('\n')]
    : [];

  return [
    ...e2eSpecFailures,
    ...e2eSupportFailures,
    ...scenarioFixtureFailures,
  ];
}

function makeInvalidAllowlistFailures(relativePath, invalidAllowlists) {
  return invalidAllowlists.map((invalidAllowlist) => [
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

function evaluateProductionPath({
  absoluteRoot,
  changedProofPaths,
  registry,
  relativePath,
  resolvedBaseRef,
  untrackedPaths,
}) {
  const surfaces = classifyProductionPath(relativePath);
  if (surfaces.length === 0) {
    return { failures: [], allowlists: [] };
  }

  const allowlist = getFeatureProofAllowlist(
    getAddedLinesForPath(absoluteRoot, resolvedBaseRef, relativePath, untrackedPaths),
  );
  const invalidAllowlistFailures = makeInvalidAllowlistFailures(relativePath, allowlist.invalid);
  if (invalidAllowlistFailures.length > 0) {
    return { failures: invalidAllowlistFailures, allowlists: [] };
  }

  if (hasAllowlist(allowlist, 'allow-refactor-only')) {
    return {
      failures: [],
      allowlists: [{ relativePath, allowlist: allowlist.valid }],
    };
  }

  const categories = uniqueCategories(surfaces).filter((categoryId) =>
    categoryId === 'browser-proof'
      ? hasAllowlist(allowlist, 'allow-browser-not-required') === false
      : true,
  );
  const registryFeatures = findFeaturesForPath(registry, relativePath);
  const missingCategories = categories.filter((categoryId) =>
    changedProofMatchesCategory(changedProofPaths, categoryId) === false,
  );
  const categoryFailures = missingCategories.length > 0
    ? [makeProofFailure({
        relativePath,
        surfaces,
        missingCategories,
        registryFeatures,
      })]
    : [];
  const registryFailures = registryFeatures.length > 0
    && registryFeatures.some((feature) => changedProofMatchesRegistryFeature(changedProofPaths, feature)) === false
    ? [makeRegistryProofFailure({
        relativePath,
        registryFeatures,
        changedProofPaths,
      })]
    : [];
  const browserAllowlists = hasAllowlist(allowlist, 'allow-browser-not-required')
    ? [{ relativePath, allowlist: allowlist.valid }]
    : [];

  return {
    failures: [
      ...categoryFailures,
      ...registryFailures,
    ],
    allowlists: browserAllowlists,
  };
}

export function checkFeatureProofs({
  rootDir = process.cwd(),
  baseRef = DEFAULT_BASE_REF,
  registryPath = DEFAULT_FEATURE_PROOF_REGISTRY_PATH,
} = {}) {
  const absoluteRoot = resolve(rootDir);
  const resolvedBaseRef = resolveBaseRef(absoluteRoot, baseRef);
  const changedPaths = listChangedPathsForResolvedBase(absoluteRoot, resolvedBaseRef);
  const changedProofPaths = changedPaths.filter(isProofPath);
  const untrackedPaths = listUntrackedPaths(absoluteRoot);
  const registryAbsolutePath = join(absoluteRoot, registryPath);
  const registry = existsSync(registryAbsolutePath)
    ? parseFeatureProofRegistry(readFileSync(registryAbsolutePath, 'utf8'))
    : { features: [] };
  const results = changedPaths.map((relativePath) => evaluateProductionPath({
    absoluteRoot,
    changedProofPaths,
    registry,
    relativePath,
    resolvedBaseRef,
    untrackedPaths,
  }));
  const failures = [
    ...results.flatMap((result) => result.failures),
    ...collectBrowserIntentFailures(absoluteRoot, changedPaths),
  ];
  const allowlists = results.flatMap((result) => result.allowlists);

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
