#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const pattern = /SPDX-License-Identifier:\s*Apache-2\.0/;
const include = ["src/**/*.ts", "scripts/**/*.mjs", "*.ts"];
const exclude = new Set(["src/env.d.ts"]);

let missing = [];
for (const p of include) {
  for await (const f of glob(p)) {
    if (exclude.has(f)) continue;
    const body = await readFile(f, "utf8");
    if (!pattern.test(body)) missing.push(f);
  }
}

if (missing.length > 0) {
  console.error("Missing SPDX header in:");
  for (const f of missing) console.error("  " + f);
  process.exit(1);
}
console.log("SPDX headers OK.");
