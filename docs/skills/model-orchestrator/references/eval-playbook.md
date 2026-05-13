# Evaluation Playbook

Use this reference when rerunning the model-orchestrator evidence loop.

## 1. Trigger evaluation / description loop

This is the quantitative check for whether the skill description triggers on the right routing prompts.

```bash
cd ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator
PYTHONPATH=. python3 -m scripts.run_loop \
  --eval-set /home/michael/claude/rpg-public/docs/skills/model-orchestrator/evals/trigger-evals.json \
  --skill-path /home/michael/.claude/skills/model-orchestrator \
  --model sonnet \
  --runs-per-query 3 \
  --timeout 30 \
  --results-dir /path/to/model-orchestrator-workspace/trigger-loop \
  --report none \
  --verbose
```

The trigger loop validates that routing-oriented prompts load the skill while unrelated prompts do not.

**Important:** the skill-creator trigger harness is a **description proxy**, not a full installed-skill fidelity test. `run_eval.py` injects a temporary entry under `.claude/commands/` so the prompt can see a synthetic available-skill item. Use it to tune the description and trigger language, but treat the Maggy benchmark workspace below as the proof for real installed behavior.

## 2. Maggy qualitative / benchmark workspace

Use the benchmark-schema evals in `evals/evals.json` to create a workspace such as:

```text
model-orchestrator-workspace/
  iteration-1/
    eval-0/
      eval_metadata.json
      with_skill/
        run-1/
          transcript.md
          grading.json
          timing.json
      without_skill/
        run-1/
          transcript.md
          grading.json
          timing.json
```

### Recommended execution pattern

- **With skill**: run Maggy normally after syncing the skill locally.
- **Without skill**: run the same Maggy prompt with `--disable-slash-commands` so the baseline has no skills.
- If you are close to a local Claude quota/reset boundary, split the run across windows or alternate configuration order on reruns so later evals do not fail just because the quota ran out mid-benchmark.

Example command shapes:

```bash
~/.claude/bin/maggy --task model-orchestrator-eval-0 -p "<prompt>"
~/.claude/bin/maggy --task model-orchestrator-eval-0 --disable-slash-commands -p "<prompt>"
```

For each run:

1. Save the full transcript/output.
2. Save timing data in `timing.json`.
3. Grade the run against the eval expectations and save `grading.json`.

## 3. Aggregate and review

Once the workspace layout exists, generate benchmark artifacts:

```bash
cd ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator
PYTHONPATH=. python3 -m scripts.aggregate_benchmark /path/to/model-orchestrator-workspace/iteration-1 --skill-name model-orchestrator
python3 eval-viewer/generate_review.py /path/to/model-orchestrator-workspace/iteration-1 --skill-name model-orchestrator --benchmark /path/to/model-orchestrator-workspace/iteration-1/benchmark.json
```

Review both:

- **Quantitative**: pass-rate delta, time delta, token/output delta
- **Qualitative**: whether the with-skill transcripts route to the right worker surface, model tier, and apply-now command more reliably than the baseline

## Keep / reject threshold

Keep or promote the skill only if both are true:

1. Trigger evals show that routing prompts reliably load the skill without broadly over-triggering.
2. The benchmark workspace shows a meaningful improvement in route quality over the no-skill baseline.
