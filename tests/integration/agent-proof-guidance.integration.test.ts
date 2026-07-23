/**
 * Test layer: integration
 * Behavior: Deterministic proof guidance keeps current proofctl planning, future validate/verify stages, package aliases, and crawler policy aligned with the released verifier.
 * Proof: Assertions compare ordered proofctl steps, future-stage warnings, release identity fields, parser schema metadata, and declarative policy command metadata across repository files.
 * Validation: pnpm vitest run --config tests/vitest.config.ts tests/integration/agent-proof-guidance.integration.test.ts
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type PackageJson = {
  scripts: Record<string, string>;
};

type CrawlerPolicy = {
  schemaVersion: string;
  challengeSchemaVersion: string;
  minimumVerifierVersion: string;
  authority: Record<string, string>;
  commandModel: {
    freeFormShell: boolean;
    commandKinds: string[];
    protectedStages: string[];
  };
  landingCommit: {
    firstParent: string;
    secondParent: string;
    signature: string;
  };
  localWorkflow: string[];
  verifier: {
    implementationLocation: string;
    release: {
      repository: string;
      tag: string;
      sourceSha: string;
      artifactDigest: string;
    };
    minimumClientVersion: string;
    serviceEndpoint?: string;
  };
};

const releasedVerifier = {
  repository: 'github.com/mcmiv413/agent-verifier',
  tag: 'v0.4.2',
  sourceSha: '31a195d774982ae04c4e157c0bbd5c3b0ff33515',
  artifactDigest: 'ab25db52939959362eaca3c4dc8374228c0e12c2532719e90a78ecb3a9591318',
} as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function parseJsonFile<T>(relativePath: string): T {
  return JSON.parse(readRepoFile(relativePath)) as T;
}

function requirePhrasesInOrder(source: string, phrases: string[]): void {
  const indexes = phrases.map((phrase) => {
    const index = source.indexOf(phrase);
    expect(index, `missing phrase: ${phrase}`).toBeGreaterThanOrEqual(0);
    return index;
  });

  expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
}

function readGuidanceFiles(relativePath: string): string[] {
  const absolutePath = join(repoRoot, relativePath);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [readFileSync(absolutePath, 'utf8')];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childRelativePath = join(relativePath, entry.name);

    if (entry.isDirectory()) {
      return readGuidanceFiles(childRelativePath);
    }

    if (entry.isFile() && /\.(json|md|ya?ml)$/u.test(entry.name)) {
      return [readRepoFile(childRelativePath)];
    }

    return [];
  });
}

describe('deterministic proof guidance', () => {
  it('keeps planning guidance anchored to verifier-selected proof obligations', () => {
    const planningSkill = readRepoFile('docs/skills/planning/SKILL.md');

    requirePhrasesInOrder(planningSkill, [
      'install the released `proofctl 0.4.2`',
      '`proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA`',
      'copy the selected obligations into the implementation plan',
      'do not choose a smaller proof set',
    ]);
    expect(planningSkill).toContain('`proofctl validate` and `proofctl verify` are documented as arriving with PR0B/PR0C, not as required current steps');
  });

  it('keeps implementation and quick tasks on local planning until remote proof arrives', () => {
    const implementationSkill = readRepoFile('docs/skills/implementation/SKILL.md');
    const quickTaskSkill = readRepoFile('docs/skills/quick-task/SKILL.md');

    requirePhrasesInOrder(implementationSkill, [
      '`pnpm run check:fast`',
      '`pnpm validate:quick`',
      '`pnpm validate`',
      '`proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA`',
    ]);
    expect(implementationSkill).toContain('Do not require `proofctl validate` or `proofctl verify` today; those authoritative remote steps arrive with PR0B/PR0C.');

    requirePhrasesInOrder(quickTaskSkill, [
      'Run the smallest relevant validation first',
      '`proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA`',
      'Do not require `proofctl validate` or `proofctl verify` today',
    ]);
    expect(quickTaskSkill).toContain('it will not be exempt from remote proof once PR0B/PR0C make validation and attestation verification available');
  });

  it('keeps post-implementation review bound to current plan evidence and future attestation identities', () => {
    const reviewSkill = readRepoFile('docs/skills/post-implementation-review/SKILL.md');

    expect(reviewSkill).toContain('verify the released `proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA` evidence');
    for (const attestationField of [
      'attestation ID',
      '`PR_HEAD_SHA`',
      '`POLICY_SHA`',
      '`LANDING_COMMIT_SHA`',
      'landing-commit parents',
      '`EVALUATED_TREE_SHA`',
      'verifier identity',
      'policy digest',
      '`proofctl verify --pr=PR_NUMBER` status',
    ]) {
      expect(reviewSkill).toContain(attestationField);
    }
    expect(reviewSkill).toContain('After PR0C makes attestations available');
  });

  it('keeps repo skill maintenance guidance on current proofctl staging', () => {
    const repoSkillsGuide = readRepoFile('docs/guides/repo-skills.md');

    requirePhrasesInOrder(repoSkillsGuide, [
      'includes advisory `proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA` during planning',
      'Do not make `proofctl validate` or `proofctl verify` required current steps',
      'document them as arriving with PR0B/PR0C',
      'Remote `proofctl validate --pr=PR_NUMBER` and `proofctl verify --pr=PR_NUMBER` become final merge-intended steps only after PR0B/PR0C provide those capabilities',
    ]);
    expect(repoSkillsGuide).not.toContain('proofctl plan --pr=PR_NUMBER');
  });

  it('exposes only the current proofctl plan alias while future-gating validate and verify', () => {
    const packageJson = parseJsonFile<PackageJson>('package.json');
    const readme = readRepoFile('README.md');

    expect(packageJson.scripts).toMatchObject({
      'proof:plan': 'proofctl plan',
    });
    expect(packageJson.scripts['proof:validate']).toBeUndefined();
    expect(packageJson.scripts['proof:verify']).toBeUndefined();
    requirePhrasesInOrder(readme, [
      '`pnpm proof:plan -- --repository PATH --base BASE_SHA --head HEAD_SHA`',
      'direct `proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA` is canonical',
      'Authoritative `proofctl validate` and attestation `proofctl verify` arrive with the PR0B/PR0C verifier service work',
    ]);
  });

  it('pins the real released verifier identity and omits the future service endpoint', () => {
    const policy = parseJsonFile<CrawlerPolicy>('proof/crawler-policy.json');

    expect(policy.schemaVersion).toBe('crawler-proof-policy/v1');
    expect(policy.challengeSchemaVersion).toBe('crawler-proof-challenge/v1');
    expect(policy.minimumVerifierVersion).toBe('0.4.2');
    expect(policy.verifier.minimumClientVersion).toBe('0.4.2');
    expect(policy.verifier.release).toEqual(releasedVerifier);
    expect(policy.verifier.serviceEndpoint).toBeUndefined();
  });

  it('keeps the crawler policy declarative and external-verifier-owned', () => {
    const policy = parseJsonFile<CrawlerPolicy>('proof/crawler-policy.json');

    expect(policy.verifier.implementationLocation).toBe('external-protected-repository');
    expect(policy.authority).toEqual({
      localEvidence: 'advisory',
      authoritativeValidation: 'remote-verifier-service',
      mergeAdmission: 'installed-github-app',
      nativeGitHubActions: 'not-authoritative',
    });
    expect(policy.commandModel.freeFormShell).toBe(false);
    expect(policy.commandModel.commandKinds).toEqual([
      'protected-stage',
      'vitest',
      'playwright',
      'head-lint',
      'head-typecheck',
      'head-build',
      'sensitivity-challenge',
    ]);
    expect(policy.commandModel.protectedStages).toEqual([
      'registry-validation',
      'feature-proof-validation',
      'proof-id-validation',
      'test-quality-validation',
      'animation-validation',
      'ability-contract-validation',
      'export-shape-validation',
    ]);
    expect(policy.landingCommit).toMatchObject({
      firstParent: 'POLICY_SHA',
      secondParent: 'PR_HEAD_SHA',
      signature: 'none',
    });
    expect(policy.localWorkflow).toEqual([
      'install-proofctl-v0.4.2-from-github.com/mcmiv413/agent-verifier-release-v0.4.2',
      'verify-proofctl-artifact-digest',
      'develop-and-run-targeted-tests',
      'proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA',
      'review-selected-obligations',
      'run-local-validation-gates',
      'commit-and-push-branch',
      'open-draft-pull-request',
      'await-pr0b-pr0c-for-authoritative-validation-attestation-and-merge-admission',
    ]);
  });

  it('keeps invalid endpoint values out of proof policy and guidance docs', () => {
    const checkedPaths = [
      'proof',
      'docs/guides/deterministic-proof.md',
      'docs/guides/repo-skills.md',
      'docs/skills',
      '.agents/skills',
      '.claude/skills',
      '.github/skills',
      'README.md',
      'docs/README.md',
    ];

    const invalidEndpointToken = ['.', 'invalid'].join('');
    const combined = checkedPaths.flatMap(readGuidanceFiles).join('\n');

    expect(combined).not.toContain(invalidEndpointToken);
  });
});
