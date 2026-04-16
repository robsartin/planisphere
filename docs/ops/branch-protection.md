# Branch Protection — `main`

`main` must be locked once Plan 01 lands so the remaining plans land via PR.

## Required protections

- Require a pull request before merging.
- Require approvals: **1**.
- Dismiss stale approvals when new commits are pushed.
- Require status checks to pass before merging:
  - `typecheck`
  - `lint`
  - `test`
  - `build`
  - `deploy`
- Require branches to be up to date before merging.
- Require linear history.
- Do not allow force pushes.
- Do not allow deletions.

## Apply via gh

The script below is idempotent; run it from the repo root:

    bash scripts/protect-main.sh <owner>/<repo>

Requires:
- `gh` CLI authenticated with admin rights on the repo.
- CI has already run on `main` at least once so the check names exist.

> **Note:** `deploy` is included in the required status checks. If the deploy
> workflow (`.github/workflows/deploy.yml`) has not been set up yet, remove
> `"deploy"` from the `contexts` array in `scripts/protect-main.sh` before
> running — otherwise branch protection will block all merges because the
> deploy check will never be reported.
