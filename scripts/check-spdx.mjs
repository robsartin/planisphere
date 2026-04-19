#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pattern = /SPDX-License-Identifier:\s*Apache-2\.0/;
const exclude = new Set(["src/env.d.ts"]);

function findFiles(dir, ext, recursive) {
  let entries;
  try {
    entries = readdirSync(dir, { recursive });
  } catch {
    return [];
  }
  return entries.map((e) => join(dir, e)).filter((p) => p.endsWith(ext) && !exclude.has(p));
}

const files = [
  ...findFiles("src", ".ts", true),
  ...findFiles("worker", ".ts", true),
  ...findFiles("scripts", ".mjs", true),
  ...findFiles(".", ".ts", false),
];

const missing = [];
for (const f of files) {
  const body = readFileSync(f, "utf8");
  if (!pattern.test(body)) missing.push(f);
}

if (missing.length > 0) {
  console.error("Missing SPDX header in:");
  for (const f of missing) console.error("  " + f);
  process.exit(1);
}
console.log("SPDX headers OK.");
