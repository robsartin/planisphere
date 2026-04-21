/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { logError, logEvent } from "./log";

/**
 * Tests for the Worker's tiny structured-logging helper. Both functions
 * emit a single-line JSON string via `console.log` / `console.error` so
 * Cloudflare's observability feed can parse events without regex.
 */

type LoggedLine = { event: string; t: number; [k: string]: unknown };

afterEach(() => {
  vi.restoreAllMocks();
});

function captureStdout(): { lines: string[] } {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return {
    get lines() {
      return spy.mock.calls.map((c) => String(c[0]));
    },
  };
}

function captureStderr(): { lines: string[] } {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  return {
    get lines() {
      return spy.mock.calls.map((c) => String(c[0]));
    },
  };
}

describe("logEvent", () => {
  it("writes one JSON line to console.log with event + t", () => {
    const out = captureStdout();
    logEvent("sweep.completed");
    expect(out.lines).toHaveLength(1);
    const parsed = JSON.parse(out.lines[0]!) as LoggedLine;
    expect(parsed.event).toBe("sweep.completed");
    expect(typeof parsed.t).toBe("number");
  });

  it("merges extra fields into the JSON line", () => {
    const out = captureStdout();
    logEvent("sweep.completed", { magicLinks: 3, sessions: 7 });
    const parsed = JSON.parse(out.lines[0]!) as LoggedLine;
    expect(parsed.magicLinks).toBe(3);
    expect(parsed.sessions).toBe(7);
  });

  it("doesn't let a `t` field in extras overwrite the timestamp", () => {
    const out = captureStdout();
    logEvent("x", { t: "nope" });
    const parsed = JSON.parse(out.lines[0]!) as LoggedLine;
    expect(typeof parsed.t).toBe("number");
  });
});

describe("logError", () => {
  it("writes one JSON line to console.error with event + t + error", () => {
    const err = captureStderr();
    logError("worker.unhandled", new Error("boom"), { path: "/api/x" });
    expect(err.lines).toHaveLength(1);
    const parsed = JSON.parse(err.lines[0]!) as LoggedLine;
    expect(parsed.event).toBe("worker.unhandled");
    expect(parsed.error).toBe("boom");
    expect(typeof parsed.stack).toBe("string");
    expect(parsed.path).toBe("/api/x");
    expect(typeof parsed.t).toBe("number");
  });

  it("stringifies non-Error values into `error`", () => {
    const err = captureStderr();
    logError("sweep.failed", "something went wrong");
    const parsed = JSON.parse(err.lines[0]!) as LoggedLine;
    expect(parsed.error).toBe("something went wrong");
    expect(parsed.stack).toBeUndefined();
  });

  it("handles null/undefined/object inputs without throwing", () => {
    const err = captureStderr();
    logError("a", null);
    logError("b", undefined);
    logError("c", { oops: true });
    expect(err.lines).toHaveLength(3);
    const a = JSON.parse(err.lines[0]!) as LoggedLine;
    const b = JSON.parse(err.lines[1]!) as LoggedLine;
    const c = JSON.parse(err.lines[2]!) as LoggedLine;
    expect(a.error).toBe("null");
    expect(b.error).toBe("undefined");
    expect(typeof c.error).toBe("string");
    expect(c.error).toContain("oops");
  });

  it("doesn't let extras overwrite event/t/error/stack", () => {
    const err = captureStderr();
    logError("e", new Error("boom"), {
      event: "nope",
      t: "nope",
      error: "nope",
      stack: "nope",
    });
    const parsed = JSON.parse(err.lines[0]!) as LoggedLine;
    expect(parsed.event).toBe("e");
    expect(typeof parsed.t).toBe("number");
    expect(parsed.error).toBe("boom");
    expect(typeof parsed.stack).toBe("string");
    expect(parsed.stack === "nope").toBe(false);
  });
});
