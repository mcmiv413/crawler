# Installation, Sync, and Rollback

## Source of truth

- Canonical authoring path: `docs/skills/model-orchestrator/`
- Generated repo mirrors: `.github/skills/model-orchestrator/`, `.claude/skills/model-orchestrator/`, `.agents/skills/model-orchestrator/`
- Local install path for Maggy / Claude Code: `~/.claude/skills/model-orchestrator/`

## Install or update locally

1. From the repo root, run:

   ```bash
   pnpm run skills:generate
    pnpm run skill:model-orchestrator:sync
   ```

2. Verify the installed copy matches the repo source:

   ```bash
   pnpm run skill:model-orchestrator:check
   ```

3. Rebuild Maggy's generated prompt artifact after prompt-fragment changes:

   ```bash
   ~/.claude-shared/bin/maggy-build-prompt.sh >/dev/null
   ```

4. Start a fresh Maggy session so the new skill description and prompt overlay are in play.

## Local runtime files affected by this rollout

- `~/.claude/profiles/maggy-settings.json`
- `~/.claude-shared/claude-code-system-prompts/customizations/maggy/manifest.json`
- `~/.claude-shared/claude-code-system-prompts/customizations/maggy/fragments/85-model-orchestrator.md`
- `~/.claude/skills/model-orchestrator/`

## Rollback

If the skill or runtime integration regresses behavior:

1. Remove the installed skill:

   ```bash
   pnpm run skill:model-orchestrator:uninstall
   ```

2. Restore the Maggy runtime files listed above to their previous contents.

3. Rebuild the generated prompt artifact again:

   ```bash
   ~/.claude-shared/bin/maggy-build-prompt.sh >/dev/null
   ```

4. Start a new Maggy session to pick up the rollback.

## Notes

- The repo skill is intentionally separate from the live local install so the authored skill can be reviewed in version control before Maggy consumes it.
- The sync script copies the full directory tree, including references and evals, so the local installed skill remains self-contained.
