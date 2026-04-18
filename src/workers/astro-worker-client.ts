/* SPDX-License-Identifier: Apache-2.0 */

/**
 * Client-side wrapper for the astro computation Web Worker.
 *
 * Manages worker lifecycle, request ID sequencing, and pending promise resolution.
 * Provides a Promise-based API so callers can await results without blocking the main thread.
 */

import type { AstroWorkerRequest, AstroWorkerResponse } from "./astro-worker";

type PendingRequest = {
  resolve: (altAzs: Float64Array, visibleIndices: Uint16Array) => void;
  reject: (reason: unknown) => void;
};

// Resolve function type for clarity
type ResolveFn = (altAzs: Float64Array, visibleIndices: Uint16Array) => void;

export type AltAzResult = {
  altAzs: Float64Array;
  visibleIndices: Uint16Array;
};

export class AstroWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 0;

  constructor() {
    this.worker = new Worker(new URL("./astro-worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<AstroWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event) => {
      // Reject all pending requests on worker error
      for (const [, pending] of this.pending) {
        pending.reject(new Error(`Worker error: ${event.message}`));
      }
      this.pending.clear();
    };
  }

  private handleMessage(response: AstroWorkerResponse): void {
    if (response.type !== "compute-altaz-result") return;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    pending.resolve(response.altAzs, response.visibleIndices);
  }

  /**
   * Compute alt/az for a flat array of [ra, dec, ra, dec, ...] pairs.
   * Returns a promise that resolves with altAzs and visible indices.
   * Uses transferable arrays for zero-copy message passing.
   */
  computeAltAz(raDecs: Float64Array, lat: number, lon: number, time: Date): Promise<AltAzResult> {
    const id = this.nextId++;
    return new Promise<AltAzResult>((resolve, reject) => {
      const resolveFn: ResolveFn = (altAzs, visibleIndices) => {
        resolve({ altAzs, visibleIndices });
      };
      this.pending.set(id, { resolve: resolveFn, reject });

      const request: AstroWorkerRequest = {
        type: "compute-altaz",
        id,
        raDecs,
        lat,
        lon,
        timeMs: time.getTime(),
      };

      // Transfer the raDecs buffer ownership to the worker (zero-copy)
      this.worker.postMessage(request, [raDecs.buffer]);
    });
  }

  terminate(): void {
    this.worker.terminate();
    for (const [, pending] of this.pending) {
      pending.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
  }
}
