/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PRO_EMAIL_ALLOWLIST,
  USER_STORAGE_KEY,
  clearUser,
  getUser,
  isPro,
  setUser,
} from "./features";

describe("features — constants", () => {
  it("exposes the PRO_EMAIL_ALLOWLIST seeded with Rob's email (lowercase)", () => {
    expect(PRO_EMAIL_ALLOWLIST.has("rob.sartin@gmail.com")).toBe(true);
  });

  it("uses the canonical user storage key", () => {
    expect(USER_STORAGE_KEY).toBe("planisphere.user.v1");
  });
});

describe("features — getUser / setUser / clearUser", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it("getUser returns { email: null } when no user is stored", () => {
    expect(getUser()).toEqual({ email: null });
  });

  it("setUser persists an email and getUser reads it back", () => {
    setUser("rob.sartin@gmail.com");
    expect(getUser()).toEqual({ email: "rob.sartin@gmail.com" });
  });

  it("setUser normalises email to lowercase", () => {
    setUser("Rob.Sartin@Gmail.COM");
    expect(getUser().email).toBe("rob.sartin@gmail.com");
  });

  it("setUser trims surrounding whitespace", () => {
    setUser("   rob.sartin@gmail.com  ");
    expect(getUser().email).toBe("rob.sartin@gmail.com");
  });

  it("clearUser removes the stored email", () => {
    setUser("someone@example.com");
    clearUser();
    expect(getUser()).toEqual({ email: null });
  });

  it("getUser returns { email: null } when the stored JSON is malformed", () => {
    globalThis.localStorage.setItem(USER_STORAGE_KEY, "not-json");
    expect(getUser()).toEqual({ email: null });
  });

  it("getUser returns { email: null } when the stored payload lacks an email string", () => {
    globalThis.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ unrelated: 1 }));
    expect(getUser()).toEqual({ email: null });
  });

  it("getUser returns { email: null } when the stored payload is not an object", () => {
    globalThis.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify("just-a-string"));
    expect(getUser()).toEqual({ email: null });
  });

  it("getUser returns { email: null } when the stored payload is null", () => {
    globalThis.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(null));
    expect(getUser()).toEqual({ email: null });
  });

  it("getUser returns { email: null } when localStorage throws on read", () => {
    const orig = globalThis.localStorage;
    const broken = {
      getItem: () => {
        throw new Error("storage denied");
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } satisfies Storage;
    Object.defineProperty(globalThis, "localStorage", { value: broken, configurable: true });
    try {
      expect(getUser()).toEqual({ email: null });
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: orig, configurable: true });
    }
  });

  it("setUser does not throw when localStorage throws on write", () => {
    const orig = globalThis.localStorage;
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } satisfies Storage;
    Object.defineProperty(globalThis, "localStorage", { value: broken, configurable: true });
    try {
      expect(() => setUser("x@y.com")).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: orig, configurable: true });
    }
  });

  it("clearUser does not throw when localStorage throws on remove", () => {
    const orig = globalThis.localStorage;
    const broken = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error("denied");
      },
      clear: () => {},
      key: () => null,
      length: 0,
    } satisfies Storage;
    Object.defineProperty(globalThis, "localStorage", { value: broken, configurable: true });
    try {
      expect(() => {
        clearUser();
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", { value: orig, configurable: true });
    }
  });
});

describe("features — isPro", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it("returns false when no user is set", () => {
    expect(isPro()).toBe(false);
  });

  it("returns true when the stored email matches the allowlist", () => {
    setUser("rob.sartin@gmail.com");
    expect(isPro()).toBe(true);
  });

  it("returns true regardless of case/whitespace in the provided email (normalisation)", () => {
    setUser("  ROB.SARTIN@gmail.com  ");
    expect(isPro()).toBe(true);
  });

  it("returns false when the stored email is not on the allowlist", () => {
    setUser("stranger@example.com");
    expect(isPro()).toBe(false);
  });

  it("returns false after clearUser", () => {
    setUser("rob.sartin@gmail.com");
    clearUser();
    expect(isPro()).toBe(false);
  });
});
