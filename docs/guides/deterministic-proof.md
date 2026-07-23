# Deterministic Proof Attestation

This repo owns crawler policy data, proof metadata, workflow guidance, and local advisory checks. The verifier implementation, proof planning, proof execution, sensitivity transformations, attestation signing, and merge admission live outside this checkout in the protected verifier service and installed GitHub App.

No crawler JavaScript or TypeScript file may select proof obligations, classify fallback scope, execute sensitivity transformations, decide pass or fail, sign attestations, or land protected branches.

## Authority Model

- Local `pnpm` validation is advisory implementation feedback.
- `proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA` is available now in the released `proofctl 0.4.2` CLI. It reports verifier-selected obligations for local advisory planning; agents copy those obligations into the implementation plan and must not choose a smaller set.
- Authoritative remote validation arrives with PR0B and PR0C. Until then, `proofctl validate` must not be treated as a required crawler-side step.
- Attestation freshness verification arrives with PR0C. Until then, `proofctl verify` must not be treated as a required crawler-side step.
- The GitHub App, not GitHub Actions or a status check with the same name, will control merge admission after PR0D.

## Crawler Policy Data

The crawler-side policy contract is [proof/crawler-policy.json](../../proof/crawler-policy.json). It is declarative data only. It records:

- the external verifier release identity fields
- protected branch requirements
- feature-contract ownership source
- verifier-controlled command kinds and protected stages
- global exact-spec rules and fallback proof mapping
- drift checkpoint and output allowlist semantics
- deterministic landing-commit metadata
- attestation identities and policy-retirement mode

Feature ownership remains in [docs/feature-proofs.yml](../feature-proofs.yml). The remote verifier reads trusted policy from `POLICY_SHA`, reconciles it with additive head proposals, and rejects same-pull-request weakening of protected obligations, proof ownership, quarantines, or challenges.

## Released Verifier

The active parser/planner release is `proofctl 0.4.2` from `github.com/mcmiv413/agent-verifier` tag `v0.4.2`.

- Source SHA: `31a195d774982ae04c4e157c0bbd5c3b0ff33515`
- Artifact SHA-256: `ab25db52939959362eaca3c4dc8374228c0e12c2532719e90a78ecb3a9591318`
- Supported policy schema: `crawler-proof-policy/v1`
- Supported challenge schema: `crawler-proof-challenge/v1`

Install from that repository's `RELEASE.md`: download `proofctl` and `proofctl.sha256` from release `v0.4.2`, run `sha256sum -c proofctl.sha256`, make the binary executable, and put it on `PATH`.

## Agent Workflow

Planning:

1. Install `proofctl 0.4.2` from the verifier release and verify its artifact digest.
2. Run `proofctl plan --repository PATH --base BASE_SHA --head HEAD_SHA`.
3. Copy the selected obligations into the implementation plan.
4. Do not replace the selected obligations with a smaller local test set.

Implementation:

1. Use targeted local tests while developing.
2. Run the local repo gates required by the change, ending with `pnpm validate`.
3. Commit and push the completed branch.
4. Do not require `proofctl validate` or `proofctl verify` until PR0B/PR0C provide the remote service and attestation verifier.

Review:

1. Verify local evidence and the advisory plan obligations produced by `proofctl plan`.
2. After PR0C, verify the attestation ID, `PR_HEAD_SHA`, `POLICY_SHA`, `LANDING_COMMIT_SHA`, landing-commit parents, `EVALUATED_TREE_SHA`, verifier identity, policy digest, and `proofctl verify` status.
3. Treat targeted tests, `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate` as advisory evidence only.

Quick tasks follow the same advisory planning rule today. A small diff will not be exempt from authoritative proof once PR0B/PR0C make remote validation and attestation verification available.
