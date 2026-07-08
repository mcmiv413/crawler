/**
 * Test layer: integration
 * Behavior: Three Animation Docs covers Three animation docs guardrail; keeps the animation authoring guide aligned with the generated-module workflow; keeps the UI design guide....
 * Proof: integrated command, service, or repository assertions verify the cross-module result.
 * Validation: pnpm vitest run tests/integration/three-animation-docs.integration.test.ts
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function readDoc(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function expectAll(source: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    expect(source).toContain(snippet);
  }
}

function expectNone(source: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    expect(source).not.toContain(snippet);
  }
}

describe('Three animation docs guardrail', () => {
  const forbiddenLegacySnippets = [
    'VITE_THREE_EFFECTS',
    'three-effect-registry',
    'apps/web/src/rendering/three/effects/',
  ] as const;

  it('keeps the animation authoring guide aligned with the generated-module workflow', () => {
    const source = readDoc('docs/guides/adding-animation.md');

    expectAll(source, [
      'apps/web/src/rendering/three/modules/<category>/<name>.ts',
      'scripts/generators/three-animation-modules.ts',
      'apps/web/src/rendering/three/generated/index.ts',
      'runThreeAnimationContract()',
      'tests/e2e/three-animation-backend.spec.ts',
      'VITE_ANIMATION_RENDERER_MODE=three',
      'three-animation-docs.fixture.ts',
    ]);
    expectNone(source, forbiddenLegacySnippets);
  });

  it('keeps the UI design guide aligned with renderer mode and ownership rules', () => {
    const source = readDoc('docs/guides/ui-design.md');

    expectAll(source, [
      'getAnimationRendererMode()',
      'VITE_ANIMATION_RENDERER_MODE=three',
      'VITE_ANIMATION_RENDERER_MODE=canvas',
      'ownership',
      'ThreeEffectsOverlay',
    ]);
    expectNone(source, forbiddenLegacySnippets);
  });

  it('keeps the testing guide aligned with WebGL proof requirements', () => {
    const source = readDoc('docs/guides/testing.md');

    expectAll(source, [
      'three-animation-docs.fixture.ts',
      'run-three-animation-contract.ts',
      'check:three-animations',
      'three-animation-backend.spec.ts',
      'data-testid="three-animation-overlay"',
      'gl.readPixels()',
      'forced WebGL failure',
    ]);
  });
});
