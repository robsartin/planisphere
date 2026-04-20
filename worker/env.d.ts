/* SPDX-License-Identifier: Apache-2.0 */
/// <reference types="@cloudflare/vitest-pool-workers" />

// Tell `cloudflare:test`'s ProvidedEnv what bindings the Worker expects.
// Keeps test code honest and lets `test-helpers.ts` export a narrowly-typed
// `env` without a cast.
import type { Env } from "./types";
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
