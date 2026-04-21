/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { el } from "./dom";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("el()", () => {
  it("creates a plain element of the given tag", () => {
    const div = el("div");
    expect(div).toBeInstanceOf(HTMLDivElement);
    expect(div.tagName).toBe("DIV");
  });

  it("sets dataset.testid via the `testid` shortcut", () => {
    const el1 = el("span", { testid: "hello" });
    expect(el1.dataset.testid).toBe("hello");
  });

  it("sets textContent via `text`", () => {
    const p = el("p", { text: "hi" });
    expect(p.textContent).toBe("hi");
  });

  it("merges style via Object.assign on node.style", () => {
    const div = el("div", { style: { color: "red", padding: "4px" } });
    expect(div.style.color).toBe("red");
    expect(div.style.padding).toBe("4px");
  });

  it("sets id + className", () => {
    const div = el("div", { id: "foo", className: "bar baz" });
    expect(div.id).toBe("foo");
    expect(div.className).toBe("bar baz");
  });

  it("sets `type` on button + input elements", () => {
    const btn = el("button", { type: "submit" });
    expect(btn.type).toBe("submit");
    const input = el("input", { type: "email" });
    expect(input.type).toBe("email");
  });

  it("falls back to setAttribute for `type` on other elements", () => {
    const div = el("div", { type: "application/json" });
    expect(div.getAttribute("type")).toBe("application/json");
  });

  it("sets placeholder on input", () => {
    const input = el("input", { placeholder: "you@example.com" });
    expect(input.placeholder).toBe("you@example.com");
  });

  it("sets href on anchor", () => {
    const a = el("a", { href: "https://example.com" });
    expect(a.href).toBe("https://example.com/");
  });

  it("applies extra dataset entries", () => {
    const div = el("div", { dataset: { foo: "1", bar: "two" } });
    expect(div.dataset.foo).toBe("1");
    expect(div.dataset.bar).toBe("two");
  });

  it("applies arbitrary attributes via `attrs`", () => {
    const div = el("div", { attrs: { role: "button", "aria-label": "x" } });
    expect(div.getAttribute("role")).toBe("button");
    expect(div.getAttribute("aria-label")).toBe("x");
  });

  it("attaches event handlers via `on`", () => {
    const handler = vi.fn();
    const btn = el("button", { on: { click: handler } });
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("appends provided children (nodes + strings) and skips null/false/undefined", () => {
    const heading = el("h2", { text: "Title" });
    const root = el("section", {
      children: [heading, " — ", null, false, undefined, "footer"],
    });
    expect(root.children.length).toBe(1);
    expect(root.childNodes.length).toBe(3);
    expect(root.textContent).toBe("Title — footer");
  });

  it("innerHTML via `html` is opt-in for callers that need it", () => {
    const div = el("div", { html: "<b>bold</b>" });
    expect(div.innerHTML).toBe("<b>bold</b>");
    expect(div.querySelector("b")).not.toBeNull();
  });
});
