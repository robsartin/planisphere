/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for AstroWorkerClient.
 *
 * We stub the global Worker constructor so we can exercise the client's
 * message-dispatch and promise-resolution logic without a real Worker.
 */

// Stub worker that captures postMessage calls and lets us fire onmessage manually
type WorkerStub = {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

let workerStub: WorkerStub;

beforeEach(() => {
  workerStub = {
    onmessage: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };

  // Stub the global Worker constructor
  vi.stubGlobal(
    "Worker",
    vi.fn().mockImplementation(() => workerStub),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Import AFTER stubbing so the client picks up the stubbed Worker
async function importClient() {
  const { AstroWorkerClient } = await import("./astro-worker-client");
  return AstroWorkerClient;
}

describe("AstroWorkerClient", () => {
  it("constructs a Worker with the correct URL and module type", async () => {
    const AstroWorkerClient = await importClient();
    new AstroWorkerClient();
    expect(Worker).toHaveBeenCalledOnce();
    const [url, opts] = (Worker as ReturnType<typeof vi.fn>).mock.calls[0] as [URL, object];
    expect(url.pathname).toContain("astro-worker");
    expect(opts).toEqual({ type: "module" });
  });

  it("resolves computeAltAz promise when worker posts a matching result", async () => {
    const AstroWorkerClient = await importClient();
    const client = new AstroWorkerClient();

    const raDecs = new Float64Array([100, 20]);
    const promise = client.computeAltAz(raDecs, 40, -74, new Date("2026-04-15T00:00:00Z"));

    // Simulate the worker posting a result back
    const altAzs = new Float64Array([45, 180]);
    const visibleIndices = new Uint16Array([0]);
    const response = {
      type: "compute-altaz-result",
      id: 0,
      altAzs,
      visibleIndices,
    };
    workerStub.onmessage?.({ data: response } as MessageEvent);

    const result = await promise;
    expect(result.altAzs).toBe(altAzs);
    expect(result.visibleIndices).toBe(visibleIndices);
  });

  it("sequences multiple requests with incrementing ids", async () => {
    const AstroWorkerClient = await importClient();
    const client = new AstroWorkerClient();

    const p1 = client.computeAltAz(
      new Float64Array([100, 20]),
      40,
      -74,
      new Date("2026-04-15T00:00:00Z"),
    );
    const p2 = client.computeAltAz(
      new Float64Array([200, -10]),
      40,
      -74,
      new Date("2026-04-15T00:00:00Z"),
    );

    const altAzs1 = new Float64Array([30, 90]);
    const altAzs2 = new Float64Array([60, 270]);

    // Resolve second request first (id=1)
    workerStub.onmessage?.({
      data: {
        type: "compute-altaz-result",
        id: 1,
        altAzs: altAzs2,
        visibleIndices: new Uint16Array(),
      },
    } as MessageEvent);

    // Resolve first request (id=0)
    workerStub.onmessage?.({
      data: {
        type: "compute-altaz-result",
        id: 0,
        altAzs: altAzs1,
        visibleIndices: new Uint16Array([0]),
      },
    } as MessageEvent);

    const results = await Promise.all([p1, p2]);
    expect(results[0].altAzs).toBe(altAzs1);
    expect(results[1].altAzs).toBe(altAzs2);
  });

  it("rejects all pending requests on worker error", async () => {
    const AstroWorkerClient = await importClient();
    const client = new AstroWorkerClient();

    const promise = client.computeAltAz(
      new Float64Array([100, 20]),
      40,
      -74,
      new Date("2026-04-15T00:00:00Z"),
    );

    workerStub.onerror?.({ message: "Worker crashed" } as ErrorEvent);

    await expect(promise).rejects.toThrow("Worker error");
  });

  it("terminate() rejects all pending requests", async () => {
    const AstroWorkerClient = await importClient();
    const client = new AstroWorkerClient();

    const promise = client.computeAltAz(
      new Float64Array([100, 20]),
      40,
      -74,
      new Date("2026-04-15T00:00:00Z"),
    );

    client.terminate();

    await expect(promise).rejects.toThrow("Worker terminated");
    expect(workerStub.terminate).toHaveBeenCalledOnce();
  });

  it("ignores messages with unknown type", async () => {
    const AstroWorkerClient = await importClient();
    void new AstroWorkerClient();

    // Should not throw
    workerStub.onmessage?.({
      data: { type: "unknown-message-type", id: 99 },
    } as MessageEvent);
  });

  it("ignores messages for unknown request id", async () => {
    const AstroWorkerClient = await importClient();
    void new AstroWorkerClient();

    // Fire a response for an id that was never requested
    workerStub.onmessage?.({
      data: {
        type: "compute-altaz-result",
        id: 9999,
        altAzs: new Float64Array(),
        visibleIndices: new Uint16Array(),
      },
    } as MessageEvent);
    // No error — just silently ignored
  });

  it("transfers the raDecs buffer to the worker", async () => {
    const AstroWorkerClient = await importClient();
    const client = new AstroWorkerClient();

    const raDecs = new Float64Array([100, 20, 200, -10]);
    void client.computeAltAz(raDecs, 40, -74, new Date("2026-04-15T00:00:00Z"));

    expect(workerStub.postMessage).toHaveBeenCalledOnce();
    const [, transferList] = workerStub.postMessage.mock.calls[0] as [unknown, ArrayBuffer[]];
    expect(transferList).toHaveLength(1);
  });
});
