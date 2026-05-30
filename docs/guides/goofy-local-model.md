# Goofy Local Model

Use this guide when you want to change the local model behind `~/.claude/bin/goofy`, reinstall the Ollama aliases, or rerun the backing-model benchmark.

## Source of truth

- Goofy baseline and routing notes: `docs/skills/model-orchestrator/references/goofy-baseline.md`
- Local profile and launcher snapshot: `docs/skills/model-orchestrator/references/local-profiles.md`
- Install / sync workflow: `docs/skills/model-orchestrator/references/installation.md`
- Eval suites: `docs/skills/model-orchestrator/evals/evals.json` and `docs/skills/model-orchestrator/evals/trigger-evals.json`

The live launcher is synced to `~/.claude/bin/goofy` so future backing-model changes can be reviewed in the repo first.

## Current recommendation

- **Primary**: `goofy-qwen3-coder-q4`
  - Base model: `hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q4_K_XL`
  - Default context: `65536`
  - Stretch context: `98304` to `131072` only if the host stays stable
- **Fallback**: `goofy-qwen3-coder-q3`
  - Base model: `hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q3_K_XL`
  - Use it only when Q4 cannot maintain the needed latency or context

Both aliases are installed with:

- `temperature: 0.7`
- `top_p: 0.8`
- `top_k: 20`
- `repeat_penalty: 1.05`

The historical baseline remains `qwen3.5:27b` at `32768` context so future comparisons stay apples-to-apples.

## Install or refresh the Ollama aliases

```bash
pnpm run goofy:model:install
```

Install a subset:

```bash
pnpm run goofy:model:install -- --profile goofy-qwen3-coder-q4
pnpm run goofy:model:install -- --profile goofy-qwen3-coder-q3
```

The installer uses `OLLAMA_URL` when it is set. Otherwise it derives the Windows-hosted Ollama endpoint from the default WSL gateway, matching the existing `claude-ollama` bridge.

Install the aliases before the first sync so the live launcher never points at a missing default model.

## Sync the live launcher

```bash
pnpm run goofy:sync
pnpm run goofy:check
```

The synced launcher defaults to `goofy-qwen3-coder-q4` and exports `OLLAMA_CONTEXT_LENGTH=65536` unless you override it.

## Run the backing-model benchmark

```bash
pnpm run goofy:model:test
pnpm run goofy:model:eval
```

This compares the default trio:

1. `current-qwen35-27b`
2. `goofy-qwen3-coder-q4`
3. `goofy-qwen3-coder-q3`

Results are written under `test-results/goofy-model-evals/<timestamp>/`.

Useful overrides:

```bash
pnpm run goofy:model:test
pnpm run goofy:model:eval -- --profile goofy-qwen3-coder-q4
pnpm run goofy:model:eval -- --results-dir test-results/goofy-model-evals/latest
pnpm run goofy:model:eval -- --timeout-ms 240000
```

`goofy:model:test` uses `tests/vitest.config.ts` directly because the repo's workspace-level single-file filter does not reliably discover root `tests/` files by path.

Each run stores raw stdout/stderr plus per-case grading. The benchmark cases are intentionally stable and explicit:

1. mini-repo architecture mapping
2. TypeScript readonly + strict-ESM constraint preservation
3. quiet-run log triage
4. source-of-truth code review

## Direct overrides

The live launcher still accepts direct model overrides:

```bash
goofy goofy-qwen3-coder-q3
GOOFY_CONTEXT_LENGTH=98304 goofy
GOOFY_MODEL="hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q3_K_XL" goofy
```

Keep the default launcher on the Q4 alias. Use the Q3 alias only when Q4 is too slow or cannot sustain the usable context window you need.
