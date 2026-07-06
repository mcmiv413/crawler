export interface E2eTestOwnership {
  readonly titles: readonly (string | undefined)[];
  readonly hasRendererTest: boolean;
}

export function hasTunedNumericAssertion(code: string): boolean {
  const assertionPattern = /expect\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\)\s*\.\s*toBe\s*\(\s*(\d+(?:\.\d+)?)\s*\)/g;
  for (const match of code.matchAll(assertionPattern)) {
    const expression = (match[1] ?? '').replace(/\s/g, '');
    const assertedValue = Number(match[2]);
    const isStructuralAssertion = assertedValue === 0 || assertedValue === 1
      || /(?:^|\.)(?:length|size)$/.test(expression);
    if (isStructuralAssertion !== true) return true;
  }
  return false;
}

export function findE2eTestOwnership(lines: readonly string[]): E2eTestOwnership {
  const titles: (string | undefined)[] = Array.from({ length: lines.length });
  const testTitlePattern = /\b(?:test|it)(?:\.(?:only|skip|fixme|fail))?\s*\(\s*(['"`])([^\n]*?)\1/;
  let braceDepth = 0;
  let activeTest: { readonly title: string; readonly bodyDepth: number } | undefined;
  let pendingTitle: string | undefined;
  let hasRendererTest = false;

  lines.forEach((line, index) => {
    const title = line.match(testTitlePattern)?.[2];
    if (title !== undefined) {
      pendingTitle = title;
      hasRendererTest ||= /\brenderer\b/i.test(title);
    }
    titles[index] = title ?? activeTest?.title ?? pendingTitle;

    const openingBraces = line.match(/\{/g)?.length ?? 0;
    const closingBraces = line.match(/\}/g)?.length ?? 0;
    const nextBraceDepth = braceDepth + openingBraces - closingBraces;
    if (activeTest === undefined && pendingTitle !== undefined && nextBraceDepth > braceDepth) {
      activeTest = { title: pendingTitle, bodyDepth: braceDepth + 1 };
      pendingTitle = undefined;
    }
    if (activeTest !== undefined && nextBraceDepth < activeTest.bodyDepth) activeTest = undefined;
    braceDepth = nextBraceDepth;
  });

  return { titles, hasRendererTest };
}
