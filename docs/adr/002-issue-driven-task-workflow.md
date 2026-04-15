# ADR 002 — Issue-driven task workflow

**Date:** 2026-04-15
**Status:** Accepted

## Context

Plans in `docs/plans/` decompose work into small, ordered tasks. We want execution to be:

- Visible — anyone can see what's in flight, queued, or blocked without reading a plan file.
- Resumable — work can be picked up across sessions, machines, or contributors without losing the thread.
- Reviewable — every task produces a PR against a protected `main`, so CI and human review gate the same small units the plan describes.
- Compatible with subagent-driven execution — an orchestrator dispatches one task at a time to a fresh subagent that does not need the whole plan in its context; it needs its task.

A single monolithic PR per plan hides progress, blocks review, and makes rollback coarse-grained. Tracking tasks only inside markdown is fragile and invisible outside the repo.

## Decision

**Every task in every plan is mirrored by exactly one GitHub issue. Execution works only open issues labeled `ready`.**

### Issue lifecycle

1. **Create.** When a plan is authored, one issue is opened per task. Title format: `Plan NN — Task M: <task title>`. Body contains: a link to the plan file anchor, the task's Files/Steps verbatim, and the list of checks the task must pass before closing (typecheck/lint/test/build as applicable).
2. **Labels.** Required labels:
   - `plan-NN` — groups all issues for a plan.
   - `task` — distinguishes task issues from bug/feature issues that may live in the same tracker.
   - **exactly one** of `ready` (actionable now), `blocked` (depends on an unfinished predecessor), or `in-progress` (a branch is open for it).
3. **Work.** To pick up a task: take any open issue with the `ready` label whose predecessors (if any) have been closed. Flip `ready` → `in-progress`, open a branch `task/NN-MM-<slug>`, and work only the steps in that issue.
4. **PR.** Each task ships as its own PR. PR body links the issue with `Closes #<n>`. CI must pass; `main` is protected and requires the checks defined in `docs/ops/branch-protection.md`.
5. **Close.** Merging the PR closes the issue via the `Closes` link. If the next task in the plan was `blocked`, the orchestrator flips its label to `ready`.
6. **Amend.** If a task turns out to be wrong, reopen the issue, add a comment explaining the pivot, and update the label. Do not silently retitle or delete — the history of the decision is part of the record.

### Ordering

Plans are a mix of strictly sequential tasks (Task 2 needs Task 1's `package.json`) and parallelizable ones. The plan document is authoritative for ordering. When authoring issues, the orchestrator marks only the currently actionable tasks `ready`; the rest start as `blocked`. For strictly linear plans, exactly one issue is `ready` at a time.

### What belongs in the issue vs. the plan

- **Plan document:** the design rationale, file layout, cross-task invariants, the full task bodies.
- **Issue:** a self-contained work order — a subagent reading only the issue (plus files it can check out) must have enough to execute without the plan in context. We accept the duplication; the plan file is the source of truth and the issue is its rendered form.

### Scope

This workflow applies to plan-driven work. Ad hoc bugs, chores, and spikes may use issues without the `task` label and without this structure. Planisphere v1 (Plans 01–06) is the first application.

## Consequences

- **Good:** Visible progress, PR-per-task review, clean rollback, subagent-friendly dispatch, protected `main` with enforced checks.
- **Good:** The `ready` label is the single queue — no ambiguity about what's next.
- **Cost:** Issue bodies duplicate task content. Plans that change mid-execution require updating both the plan file and any unstarted issues; the orchestrator owns this.
- **Cost:** Creating N issues per plan has upfront overhead; acceptable because plans are not frequent.

## Alternatives considered

- **No issues, track in markdown only.** Rejected — invisible outside the repo, awkward for subagents, no PR-per-task discipline.
- **One issue per plan, tasks as checkboxes in the body.** Rejected — hides which task is in flight, makes PRs unclear, doesn't produce a queue.
- **GitHub Projects board as the queue instead of a label.** Reasonable, not adopted for v1 — a single label is simpler, zero-config, and works from `gh` without extra API calls. Revisit if the team grows.
- **Milestones per plan.** Complementary, not a substitute. May be added later; the `plan-NN` label already groups the same way without requiring milestone creation.
