/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { messageFor, type ClientError } from "./error-messages";

/**
 * Parity test: every kind in the `ClientError` union resolves to a
 * non-empty string. If a new kind is added to either `AuthError` or
 * `NotebookError` without updating the switch, this test + tsc's
 * exhaustiveness check both catch it.
 */

const ALL_KINDS: readonly ClientError["kind"][] = [
  "invalid_email",
  "rate_limited",
  "invalid_token",
  "unauthenticated",
  "not_found",
  "invalid_payload",
  "server",
  "network",
];

describe("messageFor", () => {
  for (const kind of ALL_KINDS) {
    it(`maps "${kind}" to a non-empty user-facing string`, () => {
      const msg = messageFor({ kind } as ClientError);
      expect(msg.length).toBeGreaterThan(0);
    });
  }

  it("invalid_email mentions the email field", () => {
    expect(messageFor({ kind: "invalid_email" })).toMatch(/email/i);
  });

  it("network mentions connection / server", () => {
    expect(messageFor({ kind: "network" })).toMatch(/connection|server/i);
  });

  it("server is the generic fallback wording", () => {
    expect(messageFor({ kind: "server" })).toMatch(/something went wrong/i);
  });
});
