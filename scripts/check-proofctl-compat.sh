#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${PROOFCTL_BIN:-}" ]]; then
  echo "PROOFCTL_BIN must point to the released proofctl binary." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/proofctl-compat-XXXXXX")"

cleanup() {
  rm -rf "$temp_root"
}
trap cleanup EXIT

fixture_root="$temp_root/fixture"
mkdir -p "$fixture_root/proof"
mkdir -p "$fixture_root/docs"
cp "$repo_root/proof/crawler-policy.json" "$fixture_root/proof/crawler-policy.json"
cp "$repo_root/docs/feature-proofs.yml" "$fixture_root/docs/feature-proofs.yml"

git -C "$fixture_root" init -b main >/dev/null
git -C "$fixture_root" config user.name "Proofctl Compatibility Check"
git -C "$fixture_root" config user.email "proofctl-compat@noreply.github.com"
git -C "$fixture_root" add proof/crawler-policy.json docs/feature-proofs.yml
git -C "$fixture_root" commit -m "Add crawler policy fixture" >/dev/null
base_sha="$(git -C "$fixture_root" rev-parse HEAD)"

printf "fixture head\n" > "$fixture_root/fixture-head.txt"
git -C "$fixture_root" add fixture-head.txt
git -C "$fixture_root" commit -m "Add fixture head change" >/dev/null
head_sha="$(git -C "$fixture_root" rev-parse HEAD)"
version_output="$("$PROOFCTL_BIN" --version)"

if [[ "$version_output" != *"proofctl 0.2.0"* ]]; then
  echo "$version_output" >&2
  echo "PROOFCTL_BIN did not report proofctl 0.2.0." >&2
  exit 1
fi

"$PROOFCTL_BIN" plan --repository "$fixture_root" --base "$base_sha" --head "$head_sha" >/dev/null

echo "proofctl compatibility check passed for $base_sha..$head_sha."
