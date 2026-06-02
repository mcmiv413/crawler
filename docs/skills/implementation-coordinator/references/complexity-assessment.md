# Effort Assessment Framework

Detailed guidance for selecting the implementation worker.

## Core Principle

Route by implementation effort, risk, and ambiguity:

- **Low effort -> `goofy`**: tight scope, explicit files, clear success criteria, cheap to verify.
- **Medium effort -> `cody`**: normal implementation work, existing plan, standard repo patterns, some coordination.
- **High effort -> `codex`**: ambiguous, architectural, security-sensitive, high-risk, or broad cross-cutting work.

LOC is a secondary signal. A large mechanical change can still be medium effort, while a small security change is high effort.

## Worker Capabilities

### Goofy

- Best for narrow local tasks with explicit inputs and a verification command.
- Use only when the plan is clear enough that the brief can name the files, rules, expected output, and proof step.
- Do not use for planning, routing, architecture decisions, plugin/MCP-dependent work, or tasks that rely on ambient context.

### Cody

- Best for implementation-heavy delegated work after a plan is approved.
- Use for standard multi-file features, bugfixes, refactors, and TDD work that follows established repo patterns.
- Good default for medium effort because it has the repo implementation-worker profile.

### Codex

- Best for high-effort implementation with ambiguity, architectural tradeoffs, high-stakes validation, or repeated failed lower-worker attempts.
- Use for security-sensitive work, data migrations, breaking API changes, critical systems, or plans marked high risk.
- Use when the worker must reconcile conflicting constraints or make careful implementation judgments.

## Selection Criteria

| Effort | Worker | Primary factors | Example tasks |
| --- | --- | --- | --- |
| Low | `goofy` | Explicit plan, 1-2 files, established pattern, easy verification, low blast radius | Small config update, mechanical one-file fix, simple test-only adjustment |
| Medium | `cody` | Approved plan, several files, standard repo patterns, moderate coordination, normal product risk | New endpoint, typical feature slice, refactor with tests, bugfix needing repo context |
| High | `codex` | Ambiguous requirements, novel architecture, high-risk behavior, security/data/API impact, broad cross-module work | Auth/security change, data migration, architecture rewrite, complex state behavior |

## Practical Assessment Procedure

Ask these questions about the plan:

1. **Clarity**: Could a junior developer implement this from the plan alone?
   - Yes -> low candidate
   - Mostly -> medium candidate
   - No -> high candidate

2. **Pattern familiarity**: Does this copy an established repo pattern?
   - Copying existing patterns -> low or medium
   - Adapting standard patterns -> medium
   - Novel architecture or unknown pattern -> high

3. **Error impact**: What is the blast radius if the implementation is wrong?
   - Low and isolated -> low or medium
   - Medium product/user-visible risk -> medium
   - Security, data, API, production, or critical path risk -> high

4. **Verification**: Is success cheap to prove?
   - One obvious command or small focused test -> low candidate
   - Multiple package/layer checks -> medium
   - Requires broad validation, judgment, or investigation -> high

## Automatic Escalation to Codex

Escalate to `codex` regardless of size when the plan includes:

- Security-sensitive changes: auth, permissions, encryption, secret handling
- Data migration or schema changes
- Breaking API or contract changes
- Critical production systems or core state transitions
- Plan explicitly marked high risk
- Unclear approach or requirements
- Two failed attempts by lower-effort workers

## Force Worker Override

User can override assessment with `--force-worker goofy|cody|codex`.

Warn before honoring an override to a lower worker when automatic escalation fired:

```
Warning: Plan triggers auto-escalation ({reason}) but --force-worker overrides to {worker}. Proceed? (yes/no)
```

## Split Recommendations

Recommend splitting when assessment yields:

- High effort with 600+ LOC or 10+ files
- Multiple distinct phases visible in the plan
- High uncertainty across large scope

Split prompt template:

```
This implementation is high effort. Options:

1. Proceed with Codex
2. Split into phases
3. Manual implementation with step-by-step human oversight

Natural split points identified:
- Phase 1: [description] (~N files)
- Phase 2: [description] (~N files)
- Phase 3: [description] (~N files)

Recommendation: Split into phases for better control and testing.

Your choice? (1/2/3)
```

## Review Worker Selection

- If implementation used `goofy`, review with `goofy` only for mechanical verification; otherwise use `cody`.
- If implementation used `cody`, review with `cody`.
- If implementation used `codex` or the work is high risk, review with `codex`.

## Effort Display Template

```
Assessment: [reasoning summary] -> [worker] selected
Effort: low|medium|high
Primary risk: [short risk or "none"]

Proceed? (yes/no)
```
