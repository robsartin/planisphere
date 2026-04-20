/* SPDX-License-Identifier: Apache-2.0 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleEmailSender, ResendEmailSender, createEmailSender, RESEND_API_URL } from "./email";

/**
 * Isolated tests for the email providers. These don't touch D1 or the
 * route handlers — just verify the factory picks the right implementation
 * and that `ResendEmailSender` hits the Resend REST API correctly.
 */

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function setFetch(stub: FetchStub): void {
  globalThis.fetch = stub as typeof fetch;
}

beforeEach(() => {
  setFetch(() => Promise.reject(new Error("fetch not stubbed")));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEmailSender factory", () => {
  it("returns ConsoleEmailSender when RESEND_API_KEY is unset", () => {
    const sender = createEmailSender({ EMAIL_FROM: "noreply@example.com" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("returns ConsoleEmailSender when RESEND_API_KEY is the dev placeholder", () => {
    const sender = createEmailSender({
      RESEND_API_KEY: "",
      EMAIL_FROM: "noreply@example.com",
    });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("returns ConsoleEmailSender when EMAIL_FROM is missing even if a key is set", () => {
    const sender = createEmailSender({
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "",
    });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("returns ResendEmailSender when both are set", () => {
    const sender = createEmailSender({
      RESEND_API_KEY: "re_test_key",
      EMAIL_FROM: "noreply@example.com",
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });
});

describe("ResendEmailSender", () => {
  it("POSTs to the Resend API with Bearer auth and a JSON body", async () => {
    let capturedUrl: string | URL | Request | undefined;
    let capturedInit: RequestInit | undefined;
    setFetch((url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return Promise.resolve(new Response(JSON.stringify({ id: "x" }), { status: 200 }));
    });
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: "noreply@example.com",
    });
    await sender.sendMagicLink("alice@example.com", "https://example.com/cb?token=abc");

    expect(capturedUrl).toBe(RESEND_API_URL);
    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("authorization")).toBe("Bearer re_test_key");
    expect(headers.get("content-type")).toBe("application/json");

    const body = JSON.parse(String(capturedInit?.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
      html: string;
    };
    expect(body.from).toBe("noreply@example.com");
    expect(body.to).toEqual(["alice@example.com"]);
    expect(body.subject.length).toBeGreaterThan(0);
    expect(body.text).toContain("https://example.com/cb?token=abc");
    expect(body.html).toContain("https://example.com/cb?token=abc");
  });

  it("throws on a non-2xx response, carrying the status", async () => {
    setFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "domain not verified" }), { status: 422 }),
      ),
    );
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: "noreply@example.com",
    });
    await expect(
      sender.sendMagicLink("alice@example.com", "https://example.com/cb"),
    ).rejects.toThrow(/422/);
  });

  it("throws when fetch rejects (network failure)", async () => {
    setFetch(() => Promise.reject(new Error("offline")));
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: "noreply@example.com",
    });
    await expect(
      sender.sendMagicLink("alice@example.com", "https://example.com/cb"),
    ).rejects.toThrow(/offline/);
  });

  it("accepts any 2xx status, not only 200", async () => {
    setFetch(() => Promise.resolve(new Response(null, { status: 202 })));
    const sender = new ResendEmailSender({
      apiKey: "re_test_key",
      from: "noreply@example.com",
    });
    await expect(
      sender.sendMagicLink("alice@example.com", "https://example.com/cb"),
    ).resolves.toBeUndefined();
  });
});

describe("ConsoleEmailSender", () => {
  it("logs a line containing the address and URL", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const sender = new ConsoleEmailSender();
    await sender.sendMagicLink("alice@example.com", "https://example.com/cb?token=abc");
    expect(spy).toHaveBeenCalled();
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("alice@example.com");
    expect(line).toContain("https://example.com/cb?token=abc");
  });
});
