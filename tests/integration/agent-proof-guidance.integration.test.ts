/**
 * Test layer: integration
 * Behavior: Authoritative proof guidance keeps planning, implementation, quick-task, review, package aliases, and crawler policy aligned with the remote proofctl workflow.
 * Proof: Assertions compare ordered proofctl steps, advisory-local-gate warnings, attestation fields, and declarative policy command metadata across repository files.
 * Validation: pnpm vitest run --config tests/vitest.config.ts tests/integration/agent-proof-guidance.integration.test.ts
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

type PackageJson = {
  scripts: Record<string, string>;
};

type CrawlerPolicy = {
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
  };
};

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

describe('deterministic proof guidance', () => {
  it('keeps planning guidance anchored to verifier-selected proof obligations', () => {
    const planningSkill = readRepoFile('docs/skills/planning/SKILL.md');

    requirePhrasesInOrder(planningSkill, [
      'push the branch',
      'open a draft pull request',
      '`proofctl plan --pr=PR_NUMBER`',
      'copy the selected obligations into the implementation plan',
      'do not choose a smaller proof set',
    ]);
    expect(planningSkill).toContain('merge-intended pull-request work ends on `proofctl validate --pr=PR_NUMBER` followed by `proofctl verify --pr=PR_NUMBER`');
  });

  it('keeps implementation and quick tasks from ending on local-only evidence', () => {
    const implementationSkill = readRepoFile('docs/skills/implementation/SKILL.md');
    const quickTaskSkill = readRepoFile('docs/skills/quick-task/SKILL.md');

    requirePhrasesInOrder(implementationSkill, [
      '`pnpm run check:fast`',
      '`pnpm validate:quick`',
      '`pnpm validate`',
      '`proofctl validate --pr=PR_NUMBER`',
      '`proofctl verify --pr=PR_NUMBER`',
    ]);
    expect(implementationSkill).toContain('Do not claim completion from targeted tests, `pnpm run check:fast`, `pnpm validate:quick`, or `pnpm validate` alone');

    requirePhrasesInOrder(quickTaskSkill, [
      'commit and push the branch',
      '`proofctl validate --pr=PR_NUMBER`',
      '`proofctl verify --pr=PR_NUMBER`',
    ]);
    expect(quickTaskSkill).toContain('A small diff is not exempt from the remote proof requirement once it is intended to merge.');
  });

  it('keeps post-implementation review bound to attestation identities and verify status', () => {
    const reviewSkill = readRepoFile('docs/skills/post-implementation-review/SKILL.md');

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
  });

  it('exposes proofctl aliases while keeping direct proofctl commands canonical', () => {
    const packageJson = parseJsonFile<PackageJson>('package.json');
    const readme = readRepoFile('README.md');

    expect(packageJson.scripts).toMatchObject({
      'proof:plan': 'proofctl plan',
      'proof:validate': 'proofctl validate',
      'proof:verify': 'proofctl verify',
    });
    requirePhrasesInOrder(readme, [
      'direct `proofctl plan --pr=PR_NUMBER` is canonical',
      'direct `proofctl validate --pr=PR_NUMBER` is canonical',
      'direct `proofctl verify --pr=PR_NUMBER` is canonical',
    ]);
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
    expect(policy.localWorkflow.slice(-4)).toEqual([
      'record-remote-attestation-id',
      'proofctl verify --pr=PR_NUMBER',
      'mark-pull-request-ready',
      'request-attested-merge-through-github-app',
    ]);
  });
});
