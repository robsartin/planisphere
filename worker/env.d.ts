/* SPDX-License-Identifier: Apache-2.0 */
/// <reference types="@cloudflare/vitest-pool-workers" />

// Tell `cloudflare:test`'s ProvidedEnv what bindings the Worker expects.
// Keeps test code honest and lets `test-helpers.ts` export a narrowly-typed
// `env` without a cast.
import type { Env } from "./types";
declare module "cloudflare:test" {
  // typescript-eslint's no-empty-object-type is a false positive for the
  // `interface Foo extends Bar {}` module-augmentation pattern the Workers
  // vitest-pool docs recommend for narrowing `ProvidedEnv`. Using a `type`
  // alias would still typecheck but breaks the module-augmentation contract
  // that other declaration files elsewhere in @cloudflare/vitest-pool-workers
  // rely on.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
