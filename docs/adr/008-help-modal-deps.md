# ADR 008 — Help modal deps: marked + DOMPurify (both MIT)

**Date:** 2026-04-18
**Status:** Accepted

## Context

GitHub issue #187 asks for an in-app Help modal that renders the bundled
`docs/user-guide.md` as styled HTML. The SPA has no backend and must work
offline (the markdown is bundled at build time via Vite's `?raw` import).

Rendering Markdown → HTML cleanly in the browser needs:

1. A Markdown parser that handles the common GFM subset our guide uses
   (headings, lists, inline/block code, tables, images, links).
2. A sanitizer so any HTML produced — whether from user-supplied markdown
   in future or simply from library-generated output — is scrubbed before
   we assign it to `innerHTML`. Belt-and-suspenders even though we control
   the source markdown today.

## Decision

Add two production dependencies:

- **`marked`** (`^18.x`) — canonical tiny Markdown parser. MIT license.
  ~30 KB gzipped. No runtime deps. Actively maintained (millions of weekly
  downloads). Used by GitHub's README previewer lineage and countless
  SSGs; the default GFM mode matches how our guide is authored.
- **`dompurify`** (`^3.x`) — canonical browser-side HTML sanitizer.
  (Apache-2.0 OR MPL-2.0 dual license; we consume under Apache-2.0 to match
  our project license.) ~20 KB gzipped. Ships its own TypeScript types,
  so no separate `@types/dompurify` dev-dep is needed.

Both are piped together inside `src/ui/markdown.ts`:

```ts
import { marked } from "marked";
import DOMPurify from "dompurify";

export function renderMarkdownToSafeHtml(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}
```

Attribution is recorded in `NOTICE`. Both licenses are permissive and
Apache-2.0-compatible.

## Consequences

- **Bundle size:** roughly +50 KB gzipped total (marked ~30 KB,
  DOMPurify ~20 KB). Loaded inside the main chunk — the Help modal is a
  primary UX affordance, not worth code-splitting for the v1 savings.
- **Security:** any markdown we later accept from URLs, query params, or
  user input gets sanitized through the same path. No `innerHTML` from
  raw markdown anywhere in the app.
- **TypeScript types:** `marked` and `dompurify` both ship their own
  types — no `@types/*` dev-deps needed.

## Alternatives considered

- **`markdown-it`:** comparable size, slightly more plugin-oriented API.
  Rejected in favour of `marked` for its simpler top-level `parse` entry
  point and smaller default feature set (we don't need plugins yet).
- **Hand-rolled Markdown parser:** rejected — user-guide Markdown uses
  tables, nested lists, and fenced code blocks; rewriting a subset that
  handles those correctly is not a good use of time.
- **Skip the sanitizer (trust our own markdown):** rejected — the guide
  is ours today, but the rendering pipeline must be safe-by-default
  before it accepts anything more dynamic.
