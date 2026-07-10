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
  const describeTitlePattern = /\btest\.describe(?:\.(?:only|skip|fixme|serial|parallel))*\s*\(\s*(['"`])([^\n]*?)\1/;
  let braceDepth = 0;
  let activeTest: { readonly title: string; readonly bodyDepth: number } | undefined;
  let describeStack: readonly { readonly title: string; readonly bodyDepth: number }[] = [];
  let pendingBlock: { readonly kind: 'describe' | 'test'; readonly title: string } | undefined;
  let hasRendererTest = false;

  lines.forEach((line, index) => {
    const describeTitle = line.match(describeTitlePattern)?.[2];
    const testTitle = line.match(testTitlePattern)?.[2];
    let effectiveTestTitle: string | undefined;
    if (describeTitle !== undefined) {
      pendingBlock = { kind: 'describe', title: describeTitle };
    } else if (testTitle !== undefined) {
      effectiveTestTitle = [...describeStack.map(scope => scope.title), testTitle].join(' ');
      pendingBlock = { kind: 'test', title: effectiveTestTitle };
      hasRendererTest ||= /\brenderer\b/i.test(effectiveTestTitle);
    }
    titles[index] = effectiveTestTitle ?? activeTest?.title
      ?? (pendingBlock?.kind === 'test' ? pendingBlock.title : undefined);

    const openingBraces = line.match(/\{/g)?.length ?? 0;
    const closingBraces = line.match(/\}/g)?.length ?? 0;
    const nextBraceDepth = braceDepth + openingBraces - closingBraces;
    if (pendingBlock !== undefined && nextBraceDepth > braceDepth) {
      if (pendingBlock.kind === 'describe') {
        describeStack = [...describeStack, { title: pendingBlock.title, bodyDepth: braceDepth + 1 }];
      } else {
        activeTest = { title: pendingBlock.title, bodyDepth: braceDepth + 1 };
      }
      pendingBlock = undefined;
    }
    if (activeTest !== undefined && nextBraceDepth < activeTest.bodyDepth) activeTest = undefined;
    while (describeStack.at(-1) !== undefined
      && nextBraceDepth < (describeStack.at(-1)?.bodyDepth ?? 0)) {
      describeStack = describeStack.slice(0, -1);
    }
    braceDepth = nextBraceDepth;
  });

  return { titles, hasRendererTest };
}
