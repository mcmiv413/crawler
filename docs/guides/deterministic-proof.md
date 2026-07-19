# Deterministic Proof Attestation

This repo owns crawler policy data, proof metadata, workflow guidance, and local advisory checks. The verifier implementation, proof planning, proof execution, sensitivity transformations, attestation signing, and merge admission live outside this checkout in the protected verifier service and installed GitHub App.

No crawler JavaScript or TypeScript file may select proof obligations, classify fallback scope, execute sensitivity transformations, decide pass or fail, sign attestations, or land protected branches.

## Authority Model

- Local `pnpm` validation is advisory implementation feedback.
- Authoritative validation requires a pushed branch and draft pull request.
- `proofctl plan --pr=PR_NUMBER` reports the verifier-selected obligations; agents copy those obligations into the implementation plan and must not choose a smaller set.
- `proofctl validate --pr=PR_NUMBER` runs the remote verifier and exits zero only after a passing signed attestation is issued.
- `proofctl verify --pr=PR_NUMBER` confirms the current pull request state still matches the attestation before the pull request is marked ready.
- The GitHub App, not GitHub Actions or a status check with the same name, controls merge admission.

## Crawler Policy Data

The crawler-side policy contract is [proof/crawler-policy.json](../../proof/crawler-policy.json). It is declarative data only. It records:

- the external verifier release identity fields and service endpoint
- protected branch requirements
- feature-contract ownership source
- verifier-controlled command kinds and protected stages
- global exact-spec rules and fallback proof mapping
- drift checkpoint and output allowlist semantics
- deterministic landing-commit metadata
- attestation identities and policy-retirement mode

Feature ownership remains in [docs/feature-proofs.yml](../feature-proofs.yml). The remote verifier reads trusted policy from `POLICY_SHA`, reconciles it with additive head proposals, and rejects same-pull-request weakening of protected obligations, proof ownership, quarantines, or challenges.

## Agent Workflow

Planning:

1. Push the branch and open a draft pull request before authoritative proof planning.
2. Run `proofctl plan --pr=PR_NUMBER`.
3. Copy the selected obligations into the implementation plan.
4. Do not replace the selected obligations with a smaller local test set.

Implementation:

1. Use targeted local tests while developing.
2. Run the local repo gates required by the change, ending with `pnpm validate`.
3. Commit and push the completed branch.
4. Run `proofctl validate --pr=PR_NUMBER`.
5. Run `proofctl verify --pr=PR_NUMBER` before marking the pull request ready.

Review:

1. Verify the attestation ID.
2. Verify `PR_HEAD_SHA`, `POLICY_SHA`, `LANDING_COMMIT_SHA`, landing-commit parents, `EVALUATED_TREE_SHA`, verifier identity, policy digest, and `proofctl verify` status.
3. Treat targeted tests, `pnpm run check:fast`, `pnpm validate:quick`, and `pnpm validate` as advisory evidence only.

Quick tasks follow the same remote validation rule. A small diff is not exempt from authoritative proof once it is intended to merge.
