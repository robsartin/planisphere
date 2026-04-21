/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMentionPopover, type MentionCommand } from "./notebook-mention-popover";
import type { EntityRecord } from "../astro/entities";

/**
 * Unit tests for the @-mention suggestion popover. The tiptap side of
 * the wiring is covered in notebook-mention.test.ts; these exercise the
 * popover's DOM + keyboard behaviour in isolation.
 */

const SAMPLE: readonly EntityRecord[] = [
  { kind: "body", id: "Mars", label: "Mars" },
  { kind: "constellation", id: "Ori", label: "Orion" },
  { kind: "event", id: "perseids", label: "Perseids" },
];

function openPopover(
  items: readonly EntityRecord[] = SAMPLE,
  command: MentionCommand = vi.fn(),
): ReturnType<typeof createMentionPopover> {
  return createMentionPopover({ items, clientRect: () => null, command });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createMentionPopover", () => {
  it("appends an element to document.body with a data-testid", () => {
    const p = openPopover();
    expect(document.querySelector("[data-testid='notebook-mention-popover']")).not.toBeNull();
    p.destroy();
  });

  it("renders one row per item with kind + label", () => {
    const p = openPopover();
    const rows = document.querySelectorAll<HTMLElement>("[data-testid='notebook-mention-item']");
    expect(rows.length).toBe(SAMPLE.length);
    expect(rows[0]?.textContent).toContain("Mars");
    expect(rows[0]?.dataset.kind).toBe("body");
    expect(rows[0]?.dataset.entityId).toBe("Mars");
    p.destroy();
  });

  it("renders an empty-state element when items is []", () => {
    const p = openPopover([]);
    expect(document.querySelector("[data-testid='notebook-mention-empty']")).not.toBeNull();
    p.destroy();
  });

  it("ArrowDown / ArrowUp cycle selection", () => {
    const p = openPopover();
    p.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    p.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    // After two ArrowDowns, selection is on index 2 (Perseids).
    p.onKeyDown(new KeyboardEvent("keydown", { key: "Enter" }));
    p.destroy();
  });

  it("Enter commits the currently-selected item", () => {
    const command = vi.fn();
    const p = openPopover(SAMPLE, command);
    p.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    p.onKeyDown(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(command).toHaveBeenCalledWith({ kind: "constellation", id: "Ori" });
    p.destroy();
  });

  it("mousedown on a row commits it", () => {
    const command = vi.fn();
    const p = openPopover(SAMPLE, command);
    const row = document.querySelectorAll<HTMLElement>("[data-testid='notebook-mention-item']")[1]!;
    row.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(command).toHaveBeenCalledWith({ kind: "constellation", id: "Ori" });
    p.destroy();
  });

  it("Escape removes the popover from the DOM", () => {
    const p = openPopover();
    p.onKeyDown(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector("[data-testid='notebook-mention-popover']")).toBeNull();
    p.destroy();
  });

  it("returns false for unhandled keys", () => {
    const p = openPopover();
    const handled = p.onKeyDown(new KeyboardEvent("keydown", { key: "a" }));
    expect(handled).toBe(false);
    p.destroy();
  });

  it("returns false for ArrowDown when the list is empty", () => {
    const p = openPopover([]);
    const handled = p.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(handled).toBe(false);
    p.destroy();
  });

  it("update() swaps the items and resets the selection if out of bounds", () => {
    const command = vi.fn();
    const p = openPopover(SAMPLE, command);
    p.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    p.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    p.update({ items: SAMPLE.slice(0, 1), clientRect: null });
    p.onKeyDown(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(command).toHaveBeenCalledWith({ kind: "body", id: "Mars" });
    p.destroy();
  });

  it("destroy() is idempotent (no throw if called twice)", () => {
    const p = openPopover();
    p.destroy();
    expect(() => {
      p.destroy();
    }).not.toThrow();
  });
});
