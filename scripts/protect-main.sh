#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner>/<repo>" >&2
  exit 2
fi

payload=$(cat <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["typecheck", "lint", "test", "build", "deploy"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
)

echo "$payload" | gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${REPO}/branches/main/protection" \
  --input -

echo "Branch protection applied to ${REPO}@main."
