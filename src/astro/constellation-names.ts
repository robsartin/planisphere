/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";

export type Language = "la" | "en" | "zh" | "ar" | "el";

export const LANGUAGES: readonly Language[] = ["la", "en", "zh", "ar", "el"];

export type ConstellationNameMap = Readonly<Record<string, string>>;

export type ConstellationNamesParseError =
  | { kind: "constellation-names-invalid"; message: string }
  | { kind: "constellation-names-empty"; message: string };

export function parseConstellationNames(
  raw: unknown,
): Result<ConstellationNameMap, ConstellationNamesParseError> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return err({
      kind: "constellation-names-invalid",
      message: "Constellation names must be a plain object mapping id → name",
    });
  }

  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 0) {
      result[id] = value;
    }
  }

  if (Object.keys(result).length === 0) {
    return err({
      kind: "constellation-names-empty",
      message: "No valid string entries in constellation name map",
    });
  }

  return ok(result);
}
