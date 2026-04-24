# Architecture Decision Records

Short, dated records of the non-obvious choices that shape the codebase. A new
ADR is cheap — write one whenever the decision is not self-evident from the
code alone (a new dependency, a shift in architecture, a change in scope).

Template: [`000-template.md`](000-template.md).

## Index

| #   | Title                                                                                             | Date       |
| --- | ------------------------------------------------------------------------------------------------- | ---------- |
| 001 | [Core toolchain](001-toolchain.md)                                                                | 2026-04-15 |
| 002 | [Issue-driven task workflow](002-issue-driven-task-workflow.md)                                   | 2026-04-15 |
| 003 | [Astronomy Engine](003-astronomy-engine.md)                                                       | 2026-04-16 |
| 004 | [CesiumJS](004-cesium.md)                                                                         | 2026-04-16 |
| 005 | [vite-plugin-cesium](005-vite-plugin-cesium.md)                                                   | 2026-04-16 |
| 006 | [satellite.js](006-satellite-js.md)                                                               | 2026-04-16 |
| 007 | [Stellarium skyculture data (CC-BY-SA 4.0, CC-BY 4.0)](007-stellarium-skyculture-data.md)         | 2026-04-18 |
| 008 | [Help modal deps: marked + DOMPurify (both MIT)](008-help-modal-deps.md)                          | 2026-04-18 |
| 009 | [Backend selection: Cloudflare Workers + D1](009-backend-selection.md)                            | 2026-04-18 |
| 010 | [Auth mechanism: magic-link + OAuth over D1 sessions](010-auth-mechanism.md)                      | 2026-04-19 |
| 011 | [Auth mechanism (shipped): HMAC-signed cookies + live D1 sessions](011-auth-mechanism-shipped.md) | 2026-04-19 |
| 012 | [Worker dev deps: `@cloudflare/vitest-pool-workers` + `concurrently`](012-worker-deps.md)         | 2026-04-18 |
| 013 | [Notebook editor: tiptap (ProseMirror, MIT)](013-notebook-editor.md)                              | 2026-04-20 |
| 014 | [Email delivery: Resend HTTP API](014-email-delivery.md)                                          | 2026-04-20 |
| 015 | [Viewing Plans storage and Pro-gate enforcement](015-viewing-plans-storage-and-pro-gate.md)       | 2026-04-24 |

## Conventions

- **One decision per record.** Superseding an earlier ADR? Link from the new
  one back to the one it replaces (see 011 → 010 for the pattern).
- **Keep them short.** One screen of rationale, not a design document. Deep
  design lives in `docs/specs/` or `docs/plans/`.
- **Record reality, not intent.** If a decision changed during implementation,
  write a follow-up ADR (like 011) rather than retconning the earlier one.
- **Every new dependency needs one.** Licence, maintenance posture, and a
  one-line "why not a simpler alternative" are the minimum.
