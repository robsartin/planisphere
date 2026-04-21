/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Tiny DOM factory that collapses the `createElement` + `.style.*` +
 * `dataset.testid` + `.appendChild(child)` + `.addEventListener(...)` incantation
 * that dominates `src/ui/*.ts`. The idea is ergonomics, not a framework — every
 * returned node is still a plain HTMLElement and every DOM API on it keeps
 * working. Use the factory when it reads cleaner than hand-rolled DOM; reach
 * for `document.createElement` directly when you need something the factory
 * can't express.
 *
 * Typical call:
 *
 *   const btn = el("button", {
 *     type: "button",
 *     text: "+ New",
 *     testid: "notebook-new",
 *     style: { padding: "6px 10px", fontSize: "12px" },
 *     on: { click: () => createFresh() },
 *   });
 */

type EventHandlers = {
  [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

type ElOptions = {
  readonly testid?: string;
  readonly text?: string;
  readonly html?: string;
  readonly id?: string;
  readonly className?: string;
  readonly type?: string;
  readonly placeholder?: string;
  readonly href?: string;
  readonly style?: Partial<CSSStyleDeclaration>;
  readonly dataset?: Record<string, string>;
  readonly attrs?: Record<string, string>;
  readonly on?: EventHandlers;
  readonly children?: readonly (Node | string | null | undefined | false)[];
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: ElOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (opts.testid !== undefined) node.dataset["testid"] = opts.testid;
  if (opts.id !== undefined) node.id = opts.id;
  if (opts.className !== undefined) node.className = opts.className;

  // Tag-specific conveniences — narrow via instanceof so TS is happy.
  if (opts.type !== undefined) {
    if (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) {
      node.type = opts.type;
    } else {
      node.setAttribute("type", opts.type);
    }
  }
  if (opts.placeholder !== undefined && node instanceof HTMLInputElement) {
    node.placeholder = opts.placeholder;
  }
  if (opts.href !== undefined && node instanceof HTMLAnchorElement) {
    node.href = opts.href;
  }

  if (opts.text !== undefined) node.textContent = opts.text;
  // Explicit opt-in for raw HTML — callers should almost always prefer `text`
  // or `children`. Live XSS footgun; flagged so review catches it.
  if (opts.html !== undefined) node.innerHTML = opts.html;

  if (opts.style !== undefined) {
    Object.assign(node.style, opts.style);
  }

  if (opts.dataset !== undefined) {
    for (const [k, v] of Object.entries(opts.dataset)) {
      node.dataset[k] = v;
    }
  }

  if (opts.attrs !== undefined) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      node.setAttribute(k, v);
    }
  }

  if (opts.on !== undefined) {
    for (const [event, handler] of Object.entries(opts.on)) {
      if (handler !== undefined) {
        node.addEventListener(event, handler as EventListener);
      }
    }
  }

  if (opts.children !== undefined) {
    for (const child of opts.children) {
      if (child === null || child === undefined || child === false) continue;
      node.append(child);
    }
  }

  return node;
}
