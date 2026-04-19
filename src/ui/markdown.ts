/* SPDX-License-Identifier: Apache-2.0 */
import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Rewrite relative `./screenshots/...` references in the rendered HTML so they
 * resolve against the SPA root (served from `public/screenshots/`).
 */
function rewriteScreenshotPaths(html: string): string {
  return html.replace(/(src|href)="\.\/screenshots\//g, '$1="/screenshots/');
}

/**
 * Render a markdown string to sanitized HTML suitable for `innerHTML`.
 *
 * Pipeline:
 *   markdown -> marked.parse -> relative-path rewrite -> DOMPurify.sanitize
 *
 * Belt-and-suspenders: DOMPurify is applied even to our own bundled markdown
 * so any future source (URL-provided markdown, user input) flows through the
 * same safe path.
 */
export function renderMarkdownToSafeHtml(md: string): string {
  if (md === "") return "";
  const raw = marked.parse(md, { async: false });
  const rewritten = rewriteScreenshotPaths(raw);
  return DOMPurify.sanitize(rewritten);
}
