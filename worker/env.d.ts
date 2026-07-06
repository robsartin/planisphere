/* SPDX-License-Identifier: Apache-2.0 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />

// Vitest-pool-workers 0.18 dropped the `ProvidedEnv` module augmentation in
// favour of the global `Cloudflare.Env` namespace — `cloudflare:test` now
// types its `env` as `Cloudflare.Env`. Teach that namespace about our Worker
// bindings so `test-helpers.ts` can re-export a narrowly-typed `env` without
// a cast.
import type { Env as WorkerEnv } from "./types";
declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends WorkerEnv {}
  }
}
export {};
