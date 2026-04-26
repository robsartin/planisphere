/* SPDX-License-Identifier: Apache-2.0 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const HEMIS = new Set(["n", "s", "both"]);
const KINDS = new Set(["star", "messier", "planet", "satellite", "constellation"]);

/**
 * Parse a Markdown file with a JSON frontmatter fence into a typed plan record.
 * Returns { ok: true, value } or { ok: false, error }.
 */
export function parsePlanFile(raw) {
  const FENCE = "---";
  if (!raw.startsWith(FENCE + "\n") && !raw.startsWith(FENCE + "\r\n")) {
    return { ok: false, error: "file must start with a --- fence" };
  }
  const afterOpen = raw.slice(FENCE.length).replace(/^\r?\n/, "");
  const closeIdx = afterOpen.indexOf("\n" + FENCE);
  if (closeIdx === -1) return { ok: false, error: "no closing --- fence found" };

  const jsonBlock = afterOpen.slice(0, closeIdx).trim();
  // After the closing fence the body typically starts with `\n\n<prose>`; strip
  // leading whitespace/newlines (but not the trailing prose) so callers see the
  // semantic body only.
  const bodyMd = afterOpen
    .slice(closeIdx + FENCE.length + 1)
    .replace(/^[\r\n]+/, "")
    .trimEnd();

  let fm;
  try {
    fm = JSON.parse(jsonBlock);
  } catch (e) {
    return { ok: false, error: `JSON parse: ${e.message}` };
  }

  for (const key of ["slug", "title", "month", "hemisphere", "summary", "author", "publishedAt"]) {
    if (typeof fm[key] !== "string" || fm[key].length === 0) {
      return { ok: false, error: `missing or non-string field: ${key}` };
    }
  }
  if (!HEMIS.has(fm.hemisphere)) {
    return { ok: false, error: `bad hemisphere: ${fm.hemisphere}` };
  }
  if (!Array.isArray(fm.objects)) {
    return { ok: false, error: "objects must be an array" };
  }
  for (const [i, o] of fm.objects.entries()) {
    if (o === null || typeof o !== "object") {
      return { ok: false, error: `objects[${i}] not an object` };
    }
    if (!KINDS.has(o.kind)) {
      return { ok: false, error: `objects[${i}].kind invalid: ${o.kind}` };
    }
    if (typeof o.id !== "string" || o.id.length === 0) {
      return { ok: false, error: `objects[${i}].id missing or non-string` };
    }
    if (typeof o.label !== "string" || o.label.length === 0) {
      return { ok: false, error: `objects[${i}].label missing or non-string` };
    }
  }
  const publishedAtMs = Date.parse(fm.publishedAt);
  if (Number.isNaN(publishedAtMs)) {
    return { ok: false, error: `unparseable publishedAt: ${fm.publishedAt}` };
  }
  return {
    ok: true,
    value: {
      slug: fm.slug,
      title: fm.title,
      month: fm.month,
      hemisphere: fm.hemisphere,
      summary: fm.summary,
      author: fm.author,
      publishedAtMs,
      objects: fm.objects,
      bodyMd,
    },
  };
}

const UPSERT_SQL =
  "INSERT INTO plans (slug, title, month, hemisphere, summary, body_md, objects_json, author, published_at, created_at, updated_at) " +
  "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(slug) DO UPDATE SET " +
  "title = excluded.title, month = excluded.month, hemisphere = excluded.hemisphere, " +
  "summary = excluded.summary, body_md = excluded.body_md, objects_json = excluded.objects_json, " +
  "author = excluded.author, published_at = excluded.published_at, updated_at = excluded.updated_at";

export function buildUpsertSql(plan, nowMs) {
  return {
    sql: UPSERT_SQL,
    binds: [
      plan.slug,
      plan.title,
      plan.month,
      plan.hemisphere,
      plan.summary,
      plan.bodyMd,
      JSON.stringify(plan.objects),
      plan.author,
      plan.publishedAtMs,
      nowMs,
      nowMs,
    ],
  };
}

function sqlLiteral(v) {
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function inlineStatement({ sql, binds }) {
  let i = 0;
  return sql.replace(/\?/g, () => sqlLiteral(binds[i++])) + ";";
}

/**
 * Pull the D1 binding's `database_name` out of wrangler.jsonc so the seed
 * script doesn't drift from the deploy config. The file is JSONC (with
 * comments + trailing commas), so a strict JSON.parse fails — we strip
 * `// …` line comments, `/* … *\/` block comments, and trailing commas
 * before parsing. Cheaper than pulling in jsonc-parser as a dep.
 */
function readDatabaseNameFromWrangler(root) {
  const wranglerPath = join(root, "wrangler.jsonc");
  const raw = readFileSync(wranglerPath, "utf8");
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
  const cfg = JSON.parse(stripped);
  const dbs = Array.isArray(cfg.d1_databases) ? cfg.d1_databases : [];
  const binding = dbs.find((d) => d.binding === "DB") ?? dbs[0];
  if (!binding || typeof binding.database_name !== "string") {
    throw new Error("wrangler.jsonc missing d1_databases[].database_name");
  }
  return binding.database_name;
}

function main() {
  const root = resolve(new URL(".", import.meta.url).pathname, "..");
  const plansDir = join(root, "data", "plans");
  const sqlPath = join(root, "scripts", ".seed-plans.sql");
  const isRemote = process.argv.includes("--remote");
  const dbName = readDatabaseNameFromWrangler(root);

  let files;
  try {
    files = readdirSync(plansDir).filter((f) => f.endsWith(".md"));
  } catch (e) {
    console.error(`Cannot read ${plansDir}: ${e.message}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`No .md files in ${plansDir}`);
    process.exit(1);
  }

  const statements = [];
  const now = Date.now();
  for (const file of files) {
    const full = join(plansDir, file);
    const raw = readFileSync(full, "utf8");
    const parsed = parsePlanFile(raw);
    if (!parsed.ok) {
      console.error(`[${full}] ${parsed.error}`);
      process.exit(1);
    }
    statements.push(inlineStatement(buildUpsertSql(parsed.value, now)));
  }

  writeFileSync(sqlPath, statements.join("\n") + "\n", "utf8");

  const args = ["d1", "execute", dbName, isRemote ? "--remote" : "--local", `--file=${sqlPath}`];
  const result = spawnSync("wrangler", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("wrangler d1 execute failed");
    process.exit(result.status ?? 1);
  }
  console.log(`Upserted ${files.length} plan(s) into ${isRemote ? "remote" : "local"} D1.`);
}

// Only run main() when invoked as a script, not when imported as a module by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
