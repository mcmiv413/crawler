# Planning Complexity Rubric

Use this rubric before committing to the full planning workflow.

| Level | Typical shape | Default route |
| --- | --- | --- |
| **Quick-task** | <=3 files, <=200 LOC, clear requirements, no migrations, no architectural decisions, no cross-surface behavior | Use `quick-task` instead of a full plan |
| **Low** | Small bounded change, but needs more than one proof point or touches docs/tests/config around the main edit | Full plan, usually short and direct |
| **Medium** | Multi-file or multi-layer change, new skill/tooling behavior, generated artifacts, docs, or validation wiring | Full plan with explicit workstreams and readiness checks |
| **High** | Cross-cutting architecture changes, migrations, persistence/schema work, large tool rollouts, or substantial unknowns | Full plan plus explicit research and risk treatment |

## Escalation triggers

Treat work as at least **Medium** if any of these are true:

- the change needs new contributor docs
- generated artifacts or mirror tooling are involved
- multiple skills, packages, or runtimes must stay aligned
- the user wants a phased rollout or drift detection

Treat work as **High** if any of these are true:

- the plan changes persistence, migrations, or restore behavior
- the rollout can break an existing workflow surface
- implementation will likely exceed one bounded slice without further research
