# ADR 013 — Notebook editor: tiptap (ProseMirror, MIT)

**Date:** 2026-04-20
**Status:** Accepted

## Context

GitHub issue #219 (milestone 2D) replaces the placeholder notebook
textarea (`src/ui/notebook-workspace.ts`,
`NOTEBOOK_SCRATCH_STORAGE_KEY = ".v1"`) with a real rich-text editor. The
plan (`docs/plans/2026-04-19-07-ux-transformation.md` §2D) asks us to
pick between **tiptap** and **plain `contenteditable` with a small
toolbar** and write this ADR before any editor code lands.

Phase 2 notebooks need:

1. **Structured content.** Headings, bold/italic, bullet + numbered
   lists, inline code and fenced code, block-quotes, hyperlinks. A
   JSON-serialisable document shape we can save to D1 and reload
   losslessly.
2. **`@`-mention entity linking.** Typing `@` opens a suggestion
   popover listing sky objects, events, and places; selecting one
   inserts a node whose display text is resolved at render time from
   the astro catalogs (so a meteor-shower mention stays correct as the
   shower's date updates).
3. **Reasonable a11y out of the box.** Keyboard navigation, sensible
   ARIA, predictable selection handling on Chrome / Safari / Firefox.
4. **A document schema we control.** Custom marks (e.g. "observation
   note", "pro-tip") and custom node types (the mention node) must be
   straightforward to add without forking the editor.

Bundle cost matters — Cesium already dominates the main chunk — but we
have budget for a reasonable addition and can code-split the editor if
it grows past ~60 KB gzipped.

## Decision

Add **tiptap** (v2.x, MIT license) as the rich-text editor, layered on
**ProseMirror** (its underlying engine, also MIT / BSD-mixed, already
battle-tested via Atlassian / Notion / New York Times / GitLab).

Concretely we'll take a dependency on:

- `@tiptap/core` — the editor view + schema.
- `@tiptap/starter-kit` — the common nodes/marks (heading, paragraph,
  bold, italic, code, bullet list, ordered list, blockquote, history).
- `@tiptap/extension-mention` + `@tiptap/suggestion` — the `@`-popover
  plumbing. The suggestion list is rendered by our own `ui/` code so
  the popover matches the rest of the control surface.

All tiptap packages are MIT. They re-export ProseMirror primitives;
ProseMirror itself is MIT for `prosemirror-model` / `prosemirror-state`
/ `prosemirror-view` and MIT-like for the support packages. No
copyleft, no Apache-2.0 incompatibility.

### Data shape we commit to

The notebook document on the wire and in D1 is **tiptap JSON** — a
ProseMirror document tree — stored in a `notebooks.content_json` TEXT
column as a UTF-8-encoded JSON string. Mentions serialise to a
`mention` node with a stable `{ kind, id }` attribute pair (e.g.
`{ kind: "event", id: "perseids-2026" }`), resolved to a display
label at render time. This keeps old notebooks readable after catalog
updates.

A short rendering helper in `src/ui/notebook-render.ts` converts a
mention attr-pair into the current display label; that helper is pure
and lives under the existing 90% / 85% coverage gate. The editor UI
and the save/load routes come in follow-up PRs (scoped by the #219
plan); this ADR only commits to the library + schema choice.

## Consequences

- **Bundle size.** Core + StarterKit + Mention + Suggestion lands
  around **45–55 KB gzipped** on top of Cesium. If that proves
  unacceptable once the editor ships, we can dynamic-`import()` the
  editor chunk so it's only loaded when the Notebook pane opens — the
  SPA's initial render doesn't need it.
- **Dependency surface.** ~8 new `@tiptap/*` + `prosemirror-*` npm
  packages. pnpm's lockfile keeps them pinned; CI runs against the
  same set. The NOTICE file gains a tiptap / ProseMirror attribution
  block alongside marked / DOMPurify.
- **Schema ownership.** Mentions, custom marks, and keymap shortcuts
  are declared in our code (`src/ui/notebook-schema.ts` in the
  follow-up PR), not fetched from a CDN or stitched together via
  `innerHTML`. Tiptap's schema API enforces that every serialised
  document matches the declared grammar — malformed docs fail to
  parse rather than silently rendering wrong.
- **Testability.** Tiptap's `Editor` is constructable in jsdom (the
  existing SPA Vitest environment). We'll unit-test the mention
  round-trip and the display-label resolver without a real browser.
- **A11y.** Tiptap inherits ProseMirror's selection / IME / undo
  handling, which is the most robust open-source option available.
  We still write explicit keyboard tests at the notebook UI level.

## Alternatives considered

- **Plain `contenteditable` with a hand-rolled toolbar.** Zero runtime
  dependencies. Rejected: cross-browser `contenteditable` is famously
  inconsistent (selection handling on Safari, Android IME, undo/redo
  boundaries), and re-implementing a mention suggestion popover,
  schema validation, and keyboard navigation would be weeks of work
  that ProseMirror has already solved. We get fewer bugs and more
  features for the 50 KB cost.
- **Lexical (Meta).** Promising and smaller than ProseMirror (~22 KB
  core) but its `@mention`-style plugins are less mature and the
  library is still stabilising its public API. Its undo stack and
  schema validation are also newer. Preferred when we need a
  production-grade editor **today**.
- **Direct ProseMirror.** Strictly more powerful than tiptap but
  lower-level: configuring a schema, plugin list, and command
  surface from scratch is substantially more code. Tiptap wraps
  those same primitives with saner defaults. If we ever need to drop
  tiptap, the same document JSON loads into a hand-rolled ProseMirror
  view without data migration.
- **Textarea + Markdown pipeline** (re-using the marked + DOMPurify
  stack from ADR 008). Rejected: Markdown has no native mention
  primitive, the authoring experience is poor for users who aren't
  comfortable with Markdown, and the linked-entity auto-update
  requirement needs a structured node — not a text token the renderer
  has to parse on every save.
