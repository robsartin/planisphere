/* SPDX-License-Identifier: Apache-2.0 */
import { ok, type Result } from "../result";
import bundledTle from "../../data/tle/visual.txt?raw";

export type TleFetchError = { kind: "tle-fetch-failed"; message: string };

const CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle";

export async function fetchTle(): Promise<Result<string, TleFetchError>> {
  try {
    const response = await fetch(CELESTRAK_URL);
    if (response.ok) {
      const text = await response.text();
      if (text.trim().length > 0) {
        return ok(text);
      }
    }
  } catch {
    // network error — fall through to bundled
  }
  console.warn("[planisphere] TLE fetch failed, using bundled data");
  return ok(bundledTle);
}
